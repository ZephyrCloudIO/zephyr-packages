import type { Platform, ZeBuildAssetsMap } from 'zephyr-agent';
import {
  buildAssetsMap,
  create_minimal_build_stats,
  resolveCatalogDependencies,
  ze_log,
  ZephyrEngine,
} from 'zephyr-agent';
import type {
  ApplicationConsumes,
  ZeBuildAsset,
  ZephyrBuildStats,
  ZephyrPluginOptions,
} from 'zephyr-edge-contract';
import type { OutputAsset } from 'zephyr-rollx-internal';
import {
  extractModulesFromExposes,
  getPackageDependencies,
  load_static_entries,
  parseSharedDependencies,
} from 'zephyr-rollx-internal';
import { extract_remotes_dependencies } from './internal/extract-mf-remotes';
import { mutateMfConfig } from './internal/mutate-mf-config';

export interface ZephyrCommandWrapperConfig {
  platform: Platform;
  mode: string;
  context: string;
  outDir: string;
  mfConfig: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];
}

export class ZephyrMetroPlugin {
  private config: ZephyrCommandWrapperConfig;
  public zephyr_engine!: ZephyrEngine;

  constructor(props: ZephyrCommandWrapperConfig) {
    this.config = props;
  }

  public async beforeBuild() {
    this.zephyr_engine = await ZephyrEngine.create({
      builder: 'metro',
      context: this.config.context,
    });
    ze_log.config('Configuring with Zephyr... \n config: ', this.config);

    this.zephyr_engine.env.target = this.config.platform;

    const dependency_pairs = extract_remotes_dependencies(this.config.mfConfig?.remotes);

    ze_log.config(
      'Resolving and building towards target by zephyr_engine.env.target: ',
      this.zephyr_engine.env.target
    );

    const resolved_dependency_pairs =
      await this.zephyr_engine.resolve_remote_dependencies(dependency_pairs);

    if (this.config.mfConfig) {
      mutateMfConfig(this.zephyr_engine, this.config.mfConfig, resolved_dependency_pairs);
    }

    return this.config.mfConfig;
  }

  public async afterBuild() {
    await this.zephyr_engine.start_new_build();

    const assetsMap = await this.makeAssetsMap();

    const buildStats = await this.getBuildStats(
      Object.values(assetsMap).filter(
        (asset) => asset.extname === '.map' && !asset.path.includes('shared/')
      )
    );

    await this.zephyr_engine.upload_assets({
      assetsMap,
      buildStats,
      mfConfig: this.config.mfConfig,
    });
    await this.zephyr_engine.build_finished();
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
                      file: fileUrl.replace(this.config.context, ''),
                      url: fileUrl.replace(this.config.context, ''),
                    },
                  ],
                });
                ze_log.app('Found remote import in promise chain', {
                  remoteName,
                  componentName,
                  file: fileUrl.replace(this.config.context, ''),
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

  private async getBuildStats(bundleMaps: ZeBuildAsset[]) {
    const minimal_build_stats = await create_minimal_build_stats(this.zephyr_engine);

    const consumeMap = await this.getConsumeMap(bundleMaps);

    Object.assign(minimal_build_stats, {
      name: this.config.mfConfig?.name || this.zephyr_engine.applicationProperties.name,
      remote: this.config.mfConfig?.filename || 'remoteEntry.js',
      remotes: this.config.mfConfig?.remotes
        ? Object.keys(this.config.mfConfig.remotes)
        : [],
      metadata: {
        hasFederation: !!this.config.mfConfig,
      },
      build_target: this.zephyr_engine.env.target,
    }) as ZephyrBuildStats;

    // Extract shared dependencies from Module Federation config
    const overrides = this.config.mfConfig?.shared
      ? Object.entries(this.config.mfConfig.shared).map(([name, config]) =>
          parseSharedDependencies(name, config, this.zephyr_engine)
        )
      : [];

    // Build the stats object
    const buildStats = {
      ...minimal_build_stats,
      overrides,
      modules: extractModulesFromExposes(
        this.config.mfConfig,
        this.zephyr_engine.application_uid
      ),
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
      root: this.config.context,
      outDir:
        this.config.platform === 'ios' || this.config.platform === 'android'
          ? this.config.outDir + `/${this.config.platform}`
          : this.config.outDir,
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
