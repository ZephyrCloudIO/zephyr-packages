import type { ZeBuildAssetsMap, ZeResolvedDependency } from 'zephyr-agent';
import {
  buildAssetsMap,
  logFn,
  resolveMfManifestPath,
  ze_log,
  ZeErrors,
  ZephyrEngine,
  ZephyrError,
} from 'zephyr-agent';
import {
  assertNativeBuildTarget,
  downloadEmbeddedRemotes,
  type NativeBuildTarget,
  type NativeEnvRuntimeRoot,
  resolveRuntimeManifestUrl,
  writeEmbeddedRemoteFiles,
  writeEmbeddedRemotesRuntimePlugin,
  writeNativeEnvRuntimePlugin,
} from 'zephyr-native-internal';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import type {
  ApplicationConsumes,
  ZeBuildAsset,
  ZephyrBuildStats,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import { extract_remotes_dependencies } from './internal/extract-mf-remotes';
import { extractModulesFromExposes } from './internal/extract-modules-from-exposes';
import { getPackageDependencies } from './internal/get-package-dependencies';
import { load_static_entries } from './internal/load-static-entries';
import {
  createMinimalBuildStats,
  resolveCatalogDependencies,
} from './internal/metro-build-stats';
import { mutateMfConfig } from './internal/mutate-mf-config';
import { parseSharedDependencies } from './internal/parse-shared-dependencies';
import type { OutputAsset } from './internal/types';

export interface ZephyrCommandWrapperConfig {
  platform: NativeBuildTarget;
  mode: string;
  context: string;
  outDir: string;
  mfConfig: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];
  /** `--bundle-output` of the bundle command; embedded remotes are written next to it. */
  bundleOutput?: string;
  /** `--assets-dest` of the bundle command; iOS embedded remotes go here when set. */
  assetsDest?: string;
}

/** Normalized MF options fields Zephyr rewrites before bundling. */
interface FederationConfigTarget {
  name?: string;
  remotes?: Record<string, string>;
  plugins?: string[];
}

export class ZephyrMetroPlugin {
  #config: ZephyrCommandWrapperConfig;
  /** Rewritten remotes and generated runtime plugin paths, set by `beforeBuild`. */
  #federationOverrides: { remotes: Record<string, string>; runtimePlugins: string[] } = {
    remotes: {},
    runtimePlugins: [],
  };
  zephyr_engine!: ZephyrEngine;

  constructor(props: ZephyrCommandWrapperConfig) {
    assertNativeBuildTarget(props.platform, 'ZephyrMetroPlugin platform', 'metro');
    this.#config = props;
  }

  /**
   * Applies the remote rewrites and runtime plugins resolved by `beforeBuild` to a
   * normalized MF options object. Idempotent. MF Metro's bundle commands reload the Metro
   * config, and a function-exported config creates fresh options there, so the command
   * wrapper reapplies the overrides to that object as well.
   */
  applyToFederationConfig(config: FederationConfigTarget | undefined): void {
    if (!config) return;
    for (const [name, value] of Object.entries(this.#federationOverrides.remotes)) {
      if (config.remotes && name in config.remotes) config.remotes[name] = value;
    }
    const { runtimePlugins } = this.#federationOverrides;
    if (runtimePlugins.length === 0) return;
    config.plugins ??= [];
    for (const runtimePlugin of runtimePlugins) {
      if (!config.plugins.includes(runtimePlugin)) config.plugins.push(runtimePlugin);
    }
  }

  async beforeBuild() {
    let engineInitialized = false;
    try {
      this.zephyr_engine = await ZephyrEngine.create({
        builder: 'metro',
        context: this.#config.context,
      });
      engineInitialized = true;
      ze_log.config('Configuring with Zephyr... \n config: ', this.#config);

      this.zephyr_engine.env.target = this.#config.platform;

      const dependency_pairs = extract_remotes_dependencies(this.#config);

      ze_log.config(
        'Resolving and building towards target by zephyr_engine.env.target: ',
        this.zephyr_engine.env.target
      );

      const resolved_dependency_pairs =
        await this.zephyr_engine.resolve_remote_dependencies(dependency_pairs);

      const mfConfig = this.#config.mfConfig as FederationConfigTarget | undefined;
      if (mfConfig) {
        mutateMfConfig(
          this.zephyr_engine,
          this.#config.mfConfig,
          resolved_dependency_pairs
        );
        const remotes = mfConfig.remotes ?? {};
        for (const { name } of resolved_dependency_pairs ?? []) {
          const value = remotes[name];
          if (typeof value === 'string') this.#federationOverrides.remotes[name] = value;
        }
        const runtimeManifest =
          global.__ZEPHYR_METRO_RUNTIME_MANIFEST__ ??
          this.zephyr_engine.zephyrConfig.runtimeManifest;
        let root: NativeEnvRuntimeRoot | undefined;
        if (runtimeManifest !== undefined) {
          if (!mfConfig.name) {
            throw new TypeError('runtimeManifest requires a Module Federation name');
          }
          root = {
            name: mfConfig.name,
            applicationUid: this.zephyr_engine.application_uid,
            manifestUrl: await resolveRuntimeManifestUrl(
              this.zephyr_engine,
              runtimeManifest
            ),
          };
        }
        // Metro MF calls runtime plugins without params, so the UID map ships in a generated module.
        const envRuntimePlugin = writeNativeEnvRuntimePlugin(
          path.join(this.#config.context, 'node_modules', '.zephyr-metro'),
          resolved_dependency_pairs,
          root
        );
        if (envRuntimePlugin) {
          this.#federationOverrides.runtimePlugins.push(
            envRuntimePlugin.split(path.sep).join('/')
          );
        }
        await this.embedRemotes(dependency_pairs, resolved_dependency_pairs);
        this.applyToFederationConfig(mfConfig);
      }

      return this.#config.mfConfig;
    } catch (error: unknown) {
      if (engineInitialized && this.zephyr_engine.hasActiveBuild !== false) {
        this.zephyr_engine.build_failed();
      }
      throw error;
    }
  }

  /** `embedRemotes` in zephyr.config.*: ships the resolved remotes inside the app. */
  private async embedRemotes(
    dependency_pairs: ReadonlyArray<{ name: string }>,
    resolved_dependency_pairs: readonly ZeResolvedDependency[] | null
  ): Promise<void> {
    const embed = this.zephyr_engine.zephyrConfig.embedRemotes;
    if (!embed) return;
    const { mode, context, platform, bundleOutput, assetsDest } = this.#config;
    if (mode !== 'production') {
      ze_log.config('embedRemotes: skipped for development bundles');
      return;
    }
    try {
      createRequire(path.join(context, 'package.json')).resolve(
        'zephyr-native-cache/package.json'
      );
    } catch {
      logFn(
        'warn',
        `embedRemotes: zephyr-native-cache is not installed in ${context}. Metro apps load embedded remotes through zephyr-native-cache: install it and call ZephyrNativeCache.register() at startup, or the embedded copies are never used.`
      );
    }
    if (!bundleOutput) {
      throw new ZephyrError(ZeErrors.ERR_EMBED_REMOTES, {
        detail: 'the bundle command did not receive --bundle-output',
      });
    }

    const downloaded = await downloadEmbeddedRemotes({
      declared: dependency_pairs.map((pair) => pair.name),
      resolved: resolved_dependency_pairs ?? [],
      exclude: embed.exclude,
      bundler: 'metro',
    });
    // Where the RN build packages files next to the bundle: the Xcode bundle phase copies
    // --assets-dest into the .app; the Gradle task adds the bundle directory to assets.
    writeEmbeddedRemoteFiles(
      downloaded,
      platform === 'ios'
        ? path.resolve(assetsDest ?? path.dirname(bundleOutput))
        : path.dirname(path.resolve(bundleOutput))
    );
    if (downloaded.length > 0) {
      const runtimePlugin = writeEmbeddedRemotesRuntimePlugin(
        path.join(context, 'node_modules', '.zephyr-metro'),
        downloaded,
        'metro'
      );
      this.#federationOverrides.runtimePlugins.push(
        runtimePlugin.split(path.sep).join('/')
      );
    }
  }

  async afterBuild() {
    // create() already owns generation zero; mark it active before the idempotent start
    // call so every later failure is guaranteed to roll it back.
    let buildInProgress = true;
    try {
      this.assertEngineTargetMatchesPlatform();
      await this.zephyr_engine.start_new_build();

      const assetsMap = await this.makeAssetsMap();

      const buildStats = await this.getBuildStats(
        Object.values(assetsMap).filter(
          (asset) => asset.extname === '.map' && !asset.path.includes('shared/')
        )
      );

      // Asset discovery and stat creation are asynchronous. Check again at the
      // publication boundary in case an untyped consumer changed engine state.
      this.assertEngineTargetMatchesPlatform();
      await this.zephyr_engine.upload_assets({
        assetsMap,
        buildStats: buildStats as any,
        mfConfig: this.#config.mfConfig,
      });
      buildInProgress = false;
      await this.zephyr_engine.build_finished();
    } finally {
      if (buildInProgress && this.zephyr_engine.hasActiveBuild !== false) {
        this.zephyr_engine.build_failed();
      }
    }
  }

  private async getConsumeMap(bundleMaps: ZeBuildAsset[]) {
    const consumeMap = new Map<string, ApplicationConsumes>();

    bundleMaps.forEach((asset) => {
      try {
        const sourceMap = JSON.parse(asset['buffer'].toString());
        if (sourceMap.sourcesContent && Array.isArray(sourceMap.sourcesContent)) {
          // Filter out node_modules from sources and sourcesContent
          const filteredSources: string[] = [];
          const filteredSourcesContent: string[] = [];

          // Find indices of sources that contain node_modules
          if (sourceMap.sources && Array.isArray(sourceMap.sources)) {
            sourceMap.sources.forEach((source: string, sourceIndex: number) => {
              if (typeof source === 'string' && !source.includes('node_modules')) {
                // Keep non-node_modules sources
                if (sourceMap.sourcesContent[sourceIndex]) {
                  filteredSources.push(source);
                  filteredSourcesContent.push(sourceMap.sourcesContent[sourceIndex]);
                }
              }
            });
          }

          // Search for ES6 import statements: import ... from 'remote/component'
          const searchPattern =
            /import\s+(?:\{[^}]*\}|\w+)\s+from\s+['"]([^'"]+)\/([^'"]+)['"]/g;

          filteredSourcesContent.forEach((content: string, contentIndex: number) => {
            let match;
            while ((match = searchPattern.exec(content)) !== null) {
              if (match.length >= 3) {
                const remoteName = match[1];
                const componentName = match[2];

                const fileUrl = filteredSources[contentIndex];

                consumeMap.set(`${remoteName}-${componentName}`, {
                  consumingApplicationID: componentName,
                  applicationID: remoteName,
                  name: componentName,
                  usedIn: [
                    {
                      file: fileUrl.replace(this.#config.context, ''),
                      url: fileUrl.replace(this.#config.context, ''),
                    },
                  ],
                });
                ze_log.app('Found remote import in promise chain', {
                  remoteName,
                  componentName,
                  file: fileUrl.replace(this.#config.context, ''),
                });
              }
            }
          });
        }
      } catch (error) {
        ze_log.app('Error parsing bundle map for loadRemote calls', {
          error,
          chunkId: asset['path'],
        });
      }
    });

    return consumeMap;
  }

  private assertEngineTargetMatchesPlatform(): void {
    const engineTarget = this.zephyr_engine.env.target;
    assertNativeBuildTarget(engineTarget, 'ZephyrMetroPlugin engine target', 'metro');

    if (engineTarget !== this.#config.platform) {
      throw new TypeError(
        `ZephyrMetroPlugin engine target must match platform ${JSON.stringify(
          this.#config.platform
        )}; received ${JSON.stringify(engineTarget)}.`
      );
    }
  }

  private async getBuildStats(bundleMaps: ZeBuildAsset[]) {
    const minimal_build_stats = await createMinimalBuildStats(this.zephyr_engine);

    const consumeMap = await this.getConsumeMap(bundleMaps);

    Object.assign(minimal_build_stats, {
      name: this.#config.mfConfig?.name || this.zephyr_engine.applicationProperties.name,
      remote: this.#config.mfConfig?.filename || 'remoteEntry.js',
      mf_manifest: resolveMfManifestPath(this.#config.mfConfig?.manifest),
      remotes: this.#config.mfConfig?.remotes
        ? Object.keys(this.#config.mfConfig.remotes)
        : [],
      metadata: {
        hasFederation: !!this.#config.mfConfig,
      },
      build_target: this.zephyr_engine.env.target,
    }) as ZephyrBuildStats;

    // Extract shared dependencies from Module Federation config
    const overrides = this.#config.mfConfig?.shared
      ? Object.entries(this.#config.mfConfig.shared).map(([name, config]) =>
          parseSharedDependencies(name, config, this.zephyr_engine)
        )
      : [];

    // Build the stats object
    const buildStats = {
      ...minimal_build_stats,
      overrides,
      modules: extractModulesFromExposes(
        this.#config.mfConfig,
        this.zephyr_engine.application_uid
      ),
      // Resolved remotes; the API stores them as the version's and environments' dependencies
      zephyrDependencies: this.zephyr_engine.zephyr_dependencies,
      // Module Federation related data
      dependencies: getPackageDependencies(
        resolveCatalogDependencies(this.zephyr_engine.npmProperties.dependencies)
      ),
      devDependencies: getPackageDependencies(
        resolveCatalogDependencies(this.zephyr_engine.npmProperties.devDependencies)
      ),
      optionalDependencies: getPackageDependencies(
        resolveCatalogDependencies(this.zephyr_engine.npmProperties.optionalDependencies)
      ),
      peerDependencies: getPackageDependencies(
        resolveCatalogDependencies(this.zephyr_engine.npmProperties.peerDependencies)
      ),
      consumes: Array.from(consumeMap.values()),
    };

    return buildStats;
  }

  private async loadStaticAssets(): Promise<Record<string, OutputAsset>> {
    const assets = await load_static_entries({
      root: this.#config.context,
      outDir:
        this.#config.platform === 'ios' || this.#config.platform === 'android'
          ? this.#config.outDir + `/${this.#config.platform}`
          : this.#config.outDir,
    });

    return assets.reduce((acc, asset) => {
      acc[asset.fileName] = asset;
      return acc;
    }, {} as any);
  }

  private async makeAssetsMap(): Promise<ZeBuildAssetsMap> {
    const assets = await this.loadStaticAssets();

    return buildAssetsMap(assets, this.extractBuffer, this.getAssetType);
  }

  private extractBuffer(asset: OutputAsset): string | undefined {
    return asset.source?.toString();
  }

  private getAssetType(asset: OutputAsset): string {
    return asset.type ?? 'asset';
  }
}
