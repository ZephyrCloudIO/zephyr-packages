import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import * as path from 'node:path';
import MagicString from 'magic-string';
import type { ConfigEnv, Plugin, ResolvedConfig, UserConfig } from 'vite' with {
  'resolution-mode': 'import',
};
import {
  ApplicationContext,
  assertTapFederationPublicationMetadata,
  assertZephyrBuildTarget,
  claimPartialAssetMapBatch,
  commitPartialAssetMapClaimBatch,
  createManifestContent,
  handleGlobalError,
  normalizeBasePath,
  rewriteEnvReadsToVirtualModule,
  rollbackPartialAssetMapClaimBatch,
  resolveSelfZephyrManifestUrl,
  SAME_ORIGIN_ZEPHYR_MANIFEST_URL,
  usesPathAddressing,
  zeBuildAssets,
  ze_log,
  zeBuildDashData,
  ZeErrors,
  ZephyrEngine,
  ZephyrError,
  savePartialAssetMap,
  type PartialAssetMapClaim,
  type PartialAssetMaps,
  type ZeBuildAssetsMap,
  type ZephyrBuildHooks,
  type ZephyrBuildTarget,
} from 'zephyr-agent';
import { extractEntrypoint } from './internal/extract/extract-entrypoint';
import { extract_mf_plugins } from './internal/extract/extract_mf_plugin';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map';
import {
  ensureRuntimePlugin,
  getRuntimePluginPath,
  RESOLVED_ZEPHYR_MF_RUNTIME_PLUGIN_ID,
  ZEPHYR_MF_RUNTIME_PLUGIN_ID,
  type ModuleFederationOptions,
} from './internal/mf-vite-etl/ensure_runtime_plugin';
import { extract_remotes_dependencies } from './internal/mf-vite-etl/extract-mf-vite-remotes';
import {
  createViteModuleFederationPublicationMetadata,
  getConfigIdentities,
  type ViteModuleFederationPublicationMetadata,
} from './internal/mf-vite-etl/federation-metadata';
import type { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';
import {
  resolveVitePartialBuildScope,
  type VitePartialBuildOptions,
} from './internal/partial-build-scope';

const DEFAULT_LIBRARY_TYPE = 'module';
const VITE_ENVIRONMENT_OUTPUT_PREFIX = 'vite-environment:';

function isOriginAbsoluteBase(base: unknown): base is string {
  return typeof base === 'string' && base.startsWith('/') && !base.startsWith('//');
}

export interface WithZephyrOptions {
  /** Zephyr build target, including the `tap-app` mini-app artifact family. */
  target?: ZephyrBuildTarget;
  /** Explicit URL for this application's `zephyr-manifest.json`. */
  zephyrManifestUrl?: string;
  hooks?: ZephyrBuildHooks;
  /** One or more Module Federation containers emitted by this Vite build. */
  mfConfig?: ModuleFederationOptions | ModuleFederationOptions[];
  /** Override automatic CSR/SSR detection for Vite environment builds. */
  snapshotType?: 'csr' | 'ssr';
  /** Server entrypoint relative to the shared snapshot root. */
  entrypoint?: string;
  /** Correlates intentionally separate withZephyrPartial producer processes. */
  partialBuild?: VitePartialBuildOptions;
}

function mergeClaimedPartialMaps(
  claims: readonly PartialAssetMapClaim[]
): PartialAssetMaps {
  const merged: PartialAssetMaps = {};
  for (const claim of claims) {
    for (const [partialKey, assetsMap] of Object.entries(claim.partialAssetMaps)) {
      if (Object.prototype.hasOwnProperty.call(merged, partialKey)) {
        throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
          message: `Vite partial output "${partialKey}" was produced by multiple build scopes.`,
        });
      }
      merged[partialKey] = assetsMap;
    }
  }
  return merged;
}

function mergeAssetMaps(maps: readonly ZeBuildAssetsMap[]): ZeBuildAssetsMap {
  const merged: ZeBuildAssetsMap = {};
  const paths = new Map<string, string>();
  for (const assetsMap of maps) {
    for (const [hash, asset] of Object.entries(assetsMap)) {
      const existingHash = paths.get(asset.path);
      if (existingHash && existingHash !== hash) {
        throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
          message: `Vite emitted conflicting partial assets for "${asset.path}".`,
        });
      }
      paths.set(asset.path, hash);
      merged[hash] = asset;
    }
  }
  return merged;
}

function viteEnvironmentOutputPrefix(environmentName: string): string {
  return `${VITE_ENVIRONMENT_OUTPUT_PREFIX}${encodeURIComponent(environmentName)}:`;
}

function viteEnvironmentOutputKey(
  environmentName: string,
  outputDirectory: string,
  outputFile: string | undefined,
  outputFormat: string | undefined,
  assetsMap: ZeBuildAssetsMap
): string {
  const destination = outputFile
    ? path.join(outputDirectory, path.basename(outputFile))
    : outputDirectory;
  const assets = Object.values(assetsMap)
    .map((asset) => [asset.path.replace(/\\/g, '/'), asset.hash, asset.size] as const)
    .sort(([leftPath, leftHash], [rightPath, rightHash]) =>
      leftPath === rightPath
        ? leftHash.localeCompare(rightHash)
        : leftPath.localeCompare(rightPath)
    );
  const identity = createHash('sha256')
    .update(
      JSON.stringify({
        destination: destination.replace(/\\/g, '/'),
        format: outputFormat ?? null,
        assets,
      })
    )
    .digest('hex');
  return `${viteEnvironmentOutputPrefix(environmentName)}${identity}`;
}

function parseViteEnvironmentOutputName(key: string): string | null {
  if (!key.startsWith(VITE_ENVIRONMENT_OUTPUT_PREFIX)) return null;
  const outputIdentity = key.slice(VITE_ENVIRONMENT_OUTPUT_PREFIX.length);
  const separator = outputIdentity.indexOf(':');
  if (separator <= 0 || separator === outputIdentity.length - 1) return null;
  try {
    const environmentName = decodeURIComponent(outputIdentity.slice(0, separator));
    return environmentName || null;
  } catch {
    return null;
  }
}

function prefixAssetsMap(
  assetsMap: ZeBuildAssetsMap,
  prefix: string | undefined
): ZeBuildAssetsMap {
  const normalized = prefix?.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalized) {
    return assetsMap;
  }
  return Object.fromEntries(
    Object.values(assetsMap).map((asset) => {
      const assetPath = asset.path.replace(/\\/g, '/').replace(/^\/+/, '');
      const prefixedPath = assetPath.startsWith(`${normalized}/`)
        ? assetPath
        : `${normalized}/${assetPath}`;
      const prefixedAsset = zeBuildAssets({
        filepath: prefixedPath,
        content: asset.buffer,
      });
      return [prefixedAsset.hash, prefixedAsset];
    })
  );
}

function inferServerEntrypoint(
  partials: PartialAssetMaps,
  override: string | undefined,
  serverEnvironmentNames: readonly string[]
): string | undefined {
  if (override) {
    return normalizeEntrypoint(override);
  }
  const allPaths = Object.values(partials).flatMap((assetsMap) =>
    Object.values(assetsMap).map((asset) => asset.path)
  );
  const serverEnvironments = new Set(serverEnvironmentNames);
  const serverPaths = Object.entries(partials).flatMap(([key, assetsMap]) => {
    const environmentName = parseViteEnvironmentOutputName(key);
    return environmentName && serverEnvironments.has(environmentName)
      ? Object.values(assetsMap).map((asset) => asset.path)
      : [];
  });
  const paths = serverEnvironmentNames.length > 0 ? serverPaths : allPaths;
  const preferred = [
    'server/index.js',
    'server/index.mjs',
    'server/index.cjs',
    'ssr/index.js',
    'ssr/index.mjs',
    'ssr/index.cjs',
    'rsc/index.js',
    'rsc/index.mjs',
    'rsc/index.cjs',
  ];
  return (
    preferred.find((candidate) => paths.includes(candidate)) ??
    paths.find((candidate) => /(^|\/)(server|index)\.(mjs|cjs|js)$/.test(candidate))
  );
}

interface ViteEnvironmentMetadata {
  consumer?: string;
  outputDir?: string;
}

function commonDirectory(paths: readonly string[]): string | undefined {
  if (paths.length === 0) return undefined;
  const resolvedPaths = paths.map((item) => path.resolve(item));
  let candidate = resolvedPaths[0];
  while (
    candidate &&
    !resolvedPaths.every((item) => {
      const relative = path.relative(candidate, item);
      return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..');
    })
  ) {
    const parent = path.dirname(candidate);
    if (parent === candidate) return undefined;
    candidate = parent;
  }
  if (candidate === path.parse(candidate).root && resolvedPaths.length > 1) {
    return undefined;
  }
  return candidate;
}

function normalizeEntrypoint(entrypoint: string): string {
  const normalized = entrypoint.replace(/\\/g, '/').replace(/^\.?\/+/, '');
  const segments = normalized.split('/').filter((segment) => segment && segment !== '.');
  if (!normalized || segments.length === 0 || segments.includes('..')) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: `Vite entrypoint must be a relative path inside the snapshot: "${entrypoint}".`,
    });
  }
  return segments.join('/');
}

function uniqueParticipant(base: string, reserved: readonly string[]): string {
  let participant = base;
  let suffix = 1;
  const used = new Set(reserved);
  while (used.has(participant)) participant = `${base}-${suffix++}`;
  return participant;
}

function toModuleFederationConfigArray(
  mfConfig: WithZephyrOptions['mfConfig']
): ModuleFederationOptions[] {
  if (!mfConfig) return [];
  return Array.isArray(mfConfig) ? mfConfig : [mfConfig];
}

function attachViteFederationBuildStats<
  T extends {
    remote?: string | undefined;
    mf_manifest?: string | undefined;
    library_type?: string | undefined;
    exposes?: unknown;
    shared?: unknown;
  },
>(buildStats: T, federationMetadata: ViteModuleFederationPublicationMetadata) {
  const federation = federationMetadata.federation;
  if (!federation || federation.length === 0) {
    return buildStats;
  }

  const legacyFederation = federation.length === 1 ? federation[0] : undefined;
  return {
    ...buildStats,
    federation,
    ...(legacyFederation
      ? {
          remote: legacyFederation.remote,
          mf_manifest: legacyFederation.mf_manifest,
          library_type: legacyFederation.library_type,
          exposes: legacyFederation.exposes,
          shared: legacyFederation.shared,
        }
      : {
          remote: undefined,
          mf_manifest: undefined,
          library_type: undefined,
          exposes: undefined,
          shared: undefined,
        }),
  };
}

function loadModuleFederationPlugin() {
  let moduleFederation: {
    federation: (options: ModuleFederationOptions) => Plugin[];
  };

  try {
    moduleFederation = require('@module-federation/vite') as {
      federation: (options: ModuleFederationOptions) => Plugin[];
    };
  } catch (error) {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message: `vite-plugin-zephyr: @module-federation/vite is required when mfConfig is provided. Install a compatible version of @module-federation/vite to use Module Federation with withZephyr().${error instanceof Error ? ` Original error: ${error.message}` : ''}`,
    });
  }

  if (typeof moduleFederation.federation !== 'function') {
    throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
      message:
        'vite-plugin-zephyr: failed to load @module-federation/vite federation plugin',
    });
  }

  return moduleFederation.federation;
}

function withZephyrCore(options: WithZephyrOptions = {}): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const hooks = options.hooks;
  // TAP package descriptors lock artifact paths and hashes. Vite environment output
  // directories are only local build details, so they must not become asset prefixes.
  const preservesLockedArtifactPaths = options.target === 'tap-app';
  const buildInvocationId = `vite-${randomUUID()}`;
  // CI metadata is present for every ordinary Vite build in a workflow. Only use it
  // as a cross-process scope when the finalizer explicitly opts into partial output,
  // or when the dedicated Zephyr invocation contract is set.
  const usesExternalPartialBuild =
    options.partialBuild !== undefined ||
    Boolean(process.env['ZE_BUILD_INVOCATION_ID']?.trim());
  const externalPartialScope = usesExternalPartialBuild
    ? resolveVitePartialBuildScope(options.partialBuild)
    : undefined;

  let resolve_vite_internal_options: (value: ZephyrInternalOptions) => void;
  const vite_internal_options_defer = new Promise<ZephyrInternalOptions>((resolve) => {
    resolve_vite_internal_options = resolve;
  });

  let cachedSpecifier: string | undefined;
  let entrypoint: string;
  let zephyrManifestUrl = options.zephyrManifestUrl;
  const configureModuleFederationRuntime = (config: ModuleFederationOptions) =>
    preservesLockedArtifactPaths
      ? config
      : ensureRuntimePlugin(config, zephyrManifestUrl);
  const mfConfigSources = toModuleFederationConfigArray(options.mfConfig).map(
    configureModuleFederationRuntime
  );
  // When `mfConfig` is provided, `withZephyr()` injects the @module-federation/vite
  // plugin from that same config. That plugin later surfaces a normalized `_options`
  // (expanded `exposes`/`shared`, extra MF defaults) that describes the very same
  // container as the source config above. Auto-registering it too would push two
  // divergent configs sharing one identity, which the publication merge rejects as a
  // conflict. Record the owned identities so those already-known plugins are skipped.
  const ownedConfigIdentities = new Set(
    mfConfigSources.flatMap((config) => getConfigIdentities(config))
  );
  let environmentNames: string[] = [];
  let environmentMetadata = new Map<string, ViteEnvironmentMetadata>();
  let sharedOutputRoot: string | undefined;
  let isWatchMode = false;
  let buildGeneration = 0;
  let applicationContext: ApplicationContext | undefined;
  let uploadMetadata: { snapshotType: 'csr' | 'ssr'; entrypoint?: string } | undefined;
  let baseHref = '';
  let supportsBuildApp = false;

  const registerModuleFederationConfigs = (
    configs: readonly ModuleFederationOptions[]
  ) => {
    for (const config of configs) {
      // Skip plugins whose container identity was already provided via
      // `options.mfConfig`; `withZephyr()` injected them, so their normalized
      // `_options` is a duplicate of a source config we already hold.
      const identities = getConfigIdentities(config);
      if (identities.some((identity) => ownedConfigIdentities.has(identity))) {
        continue;
      }
      const runtimeConfigured = configureModuleFederationRuntime(config);
      if (!mfConfigSources.includes(runtimeConfigured)) {
        mfConfigSources.push(runtimeConfigured);
        for (const identity of getConfigIdentities(runtimeConfigured)) {
          ownedConfigIdentities.add(identity);
        }
      }
    }
  };

  const getModuleFederationPublicationMetadata = () =>
    createViteModuleFederationPublicationMetadata(mfConfigSources);

  return {
    name: 'with-zephyr',
    // Run before Vite's env replacement so ZE_PUBLIC_* reads can be rewritten first.
    enforce: 'pre',

    config: (config: UserConfig, env: ConfigEnv) => {
      // If MF was configured separately, inject the Zephyr runtime plugin before MF emits.
      registerModuleFederationConfigs(
        extract_mf_plugins(config.plugins ?? []).map((plugin) => plugin._options)
      );

      // Relative assets are valid for hostname deployments and required when any
      // deployment target later selects path addressing. This hook must remain fully
      // synchronous and local because Vite resolves `base` before configResolved.
      return !preservesLockedArtifactPaths &&
        env.command === 'build' &&
        config.base == null
        ? { base: './' }
        : null;
    },

    configResolved: async (config: ResolvedConfig) => {
      // Vite 8 is ESM-only. Keep the published plugin CommonJS-compatible by loading
      // runtime values natively only after Vite invokes the plugin.
      const vite = await import('vite');
      supportsBuildApp = Number.parseInt(vite.version.split('.')[0] ?? '0', 10) >= 6;
      const root = config.root;
      baseHref = normalizeBasePath(config.base);
      // Normalize the entrypoint early so uploads use the same path in serve/build.
      entrypoint = normalizeEntrypoint(options.entrypoint ?? extractEntrypoint(config));
      isWatchMode = Boolean(config.build?.watch);
      const configuredEnvironments =
        (
          config as unknown as {
            environments?: Record<
              string,
              { consumer?: string; build?: { outDir?: string } }
            >;
          }
        ).environments ?? {};
      environmentNames = Object.keys(configuredEnvironments);
      environmentMetadata = new Map(
        Object.entries(configuredEnvironments).map(([name, environment]) => [
          name,
          {
            consumer: environment.consumer,
            outputDir: environment.build?.outDir
              ? path.resolve(root, environment.build.outDir)
              : undefined,
          },
        ])
      );
      const outputDirectories = [...environmentMetadata.values()]
        .map(({ outputDir }) => outputDir)
        .filter((value): value is string => !!value);
      sharedOutputRoot =
        !preservesLockedArtifactPaths &&
        outputDirectories.length === environmentNames.length
          ? commonDirectory(outputDirectories)
          : undefined;

      // Initialize the Zephyr engine in both serve and build flows.
      zephyr_defer_create({
        builder: 'vite',
        context: root,
        target: options.target,
      });

      try {
        const zephyrEngine = await zephyr_engine_defer;
        zephyrManifestUrl = await resolveSelfZephyrManifestUrl(
          zephyrEngine,
          options.zephyrManifestUrl
        );
        for (const mfConfig of mfConfigSources) {
          configureModuleFederationRuntime(mfConfig);
        }
        for (const plugin of extract_mf_plugins(config.plugins ?? [])) {
          configureModuleFederationRuntime(plugin._options);
        }
        if (
          usesPathAddressing(await zephyrEngine.application_configuration) &&
          isOriginAbsoluteBase(config.base)
        ) {
          ze_log.init(
            `The resolved Vite base '${config.base}' is still origin-absolute for a path-addressed target. A later config hook may have overridden Zephyr's relative base.`
          );
        }
      } catch (error) {
        handleGlobalError(error);
      }

      resolve_vite_internal_options({
        root,
        outDir: config.build?.outDir,
        publicDir: config.publicDir,
        target: options.target,
      });

      registerModuleFederationConfigs(
        extract_mf_plugins(config.plugins ?? []).map((plugin) => plugin._options)
      );
      const federationMetadata = getModuleFederationPublicationMetadata();
      const mfConfigs = federationMetadata.mfConfigs ?? [];

      if (mfConfigs.length > 0 && !preservesLockedArtifactPaths) {
        try {
          // Resolve remotes early so zephyr-manifest.json includes runtime dependencies.
          const dependencyPairs = [
            ...new Map(
              mfConfigs
                .flatMap((mfConfig) => extract_remotes_dependencies(root, mfConfig) ?? [])
                .map((dependency) => [
                  `${dependency.name}:${dependency.version}`,
                  dependency,
                ])
            ).values(),
          ];
          if (dependencyPairs.length > 0) {
            const zephyr_engine = await zephyr_engine_defer;
            await zephyr_engine.resolve_remote_dependencies(
              dependencyPairs,
              DEFAULT_LIBRARY_TYPE
            );
            ze_log.remotes(
              `Resolved ${dependencyPairs.length} remote dependencies in configResolved`
            );
          }
        } catch (error) {
          handleGlobalError(error);
        }
      }

      try {
        // Mirror ZE_PUBLIC_* into process.env for agent-side manifest generation.
        const loaded = vite.loadEnv(config.mode || 'production', root, '');
        for (const [k, v] of Object.entries(loaded)) {
          if (
            k.startsWith('ZE_PUBLIC_') &&
            typeof v === 'string' &&
            !(k in process.env)
          ) {
            process.env[k] = v;
          }
        }
      } catch {
        // ignore if loadEnv unavailable
      }
    },

    resolveId: async (source) => {
      if (source === ZEPHYR_MF_RUNTIME_PLUGIN_ID) {
        return RESOLVED_ZEPHYR_MF_RUNTIME_PLUGIN_ID;
      }

      try {
        const zephyr_engine = await zephyr_engine_defer;
        if (!cachedSpecifier) {
          cachedSpecifier = `env:vars:${zephyr_engine.application_uid}`;
        }
        if (source === cachedSpecifier) {
          if (process.env['NODE_ENV'] === 'development') {
            // Keep dev env imports aligned with the manifest JSON route used by other Zephyr plugins.
            return zephyrManifestUrl ?? SAME_ORIGIN_ZEPHYR_MANIFEST_URL;
          }
          return { id: source, external: true };
        }
      } catch {
        // ignore
      }
      return null;
    },

    load: async (id) => {
      if (id === RESOLVED_ZEPHYR_MF_RUNTIME_PLUGIN_ID) {
        return readFile(getRuntimePluginPath(), 'utf8');
      }

      return null;
    },

    transform: {
      order: 'post',
      // Limit the hook to source-like files only.
      filter: {
        id: /\.(mjs|cjs|js|ts|jsx|tsx)/,
      },
      handler: async (code, id) => {
        // TAP package descriptors lock finalized module bytes. ZE_PUBLIC rewrites are a
        // web-runtime convenience and must not alter SDK-emitted source files.
        if (preservesLockedArtifactPaths) {
          return null;
        }
        try {
          // Rewrite ZE_PUBLIC_* reads in app code; node_modules stay untouched.
          if (!id.includes('node_modules')) {
            const zephyr_engine = await zephyr_engine_defer;
            if (!cachedSpecifier) {
              cachedSpecifier = `env:vars:${zephyr_engine.application_uid}`;
            }
            const res = rewriteEnvReadsToVirtualModule(String(code), cachedSpecifier);
            if (res && typeof res.code === 'string' && res.code !== code) {
              code = res.code;
              return {
                code,
                map: new MagicString(code).generateMap({
                  hires: true,
                }),
              };
            }
          }

          return null;
        } catch (error) {
          handleGlobalError(error);
          return null;
        }
      },
    },

    renderChunk: {
      order: 'post',
      handler(code) {
        if (preservesLockedArtifactPaths || !cachedSpecifier) return null;

        // Rolldown exposes generated chunks as read-only objects. Use the transform
        // hook intended for chunk rewrites instead of mutating generateBundle output.
        const importWithoutAttribute = new RegExp(
          `import\\s+([^\\s]+)\\s+from\\s*['"]${cachedSpecifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
          'g'
        );
        const nextCode = code.replace(
          importWithoutAttribute,
          `import $1 from '${cachedSpecifier}' with { type: 'json' }`
        );
        return nextCode === code ? null : { code: nextCode, map: null };
      },
    },

    generateBundle: async function () {
      // TAP's SDK may have already emitted and locked this manifest from either the
      // Rollup bundle or Vite's public/static assets. Let extraction carry those exact
      // bytes through; upload_assets still supplies the ordinary fallback when absent.
      if (preservesLockedArtifactPaths) {
        return;
      }
      try {
        const zephyr_engine = await zephyr_engine_defer;
        const dependencies = zephyr_engine.federated_dependencies || [];
        const manifestContent = createManifestContent(dependencies, true);

        this.emitFile({
          type: 'asset',
          fileName: 'zephyr-manifest.json',
          source: manifestContent,
        });
      } catch (error) {
        handleGlobalError(error);
        this.emitFile({
          type: 'asset',
          fileName: 'zephyr-manifest.json',
          source: JSON.stringify(
            {
              version: '1.0.0',
              timestamp: new Date().toISOString(),
              dependencies: {},
              zeVars: {},
            },
            null,
            2
          ),
        });
      }
    },

    configureServer: async (server) => {
      try {
        const zephyr_engine = await zephyr_engine_defer;
        if (!cachedSpecifier) {
          cachedSpecifier = `env:vars:${zephyr_engine.application_uid}`;
        }

        server.middlewares.use((req, res, next) => {
          void (async () => {
            if (!req.url) {
              next();
              return;
            }

            const requestUrl = req.url.split('?')[0];

            if (requestUrl === '/zephyr-manifest.json') {
              try {
                const dependencies = zephyr_engine.federated_dependencies || [];
                const manifestContent = createManifestContent(dependencies, true);
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.end(manifestContent);
                return;
              } catch (error) {
                handleGlobalError(error);
              }
            }

            next();
          })();
        });
      } catch {
        // ignore
      }
    },

    writeBundle: async function (outputOptions, bundle) {
      const partialClaims: PartialAssetMapClaim[] = [];
      try {
        const [vite_internal_options, zephyr_engine] = await Promise.all([
          vite_internal_options_defer,
          zephyr_engine_defer,
        ]);
        zephyr_engine.buildProperties.baseHref = baseHref;

        const environmentName = (this as unknown as { environment?: { name?: string } })
          .environment?.name;
        const isMultiEnvironment = environmentNames.length > 1;
        if (isWatchMode && isMultiEnvironment) {
          throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
            message:
              'Vite multi-environment watch publication is not supported because ' +
              'environment rebuilds do not expose an atomic application generation.',
          });
        }
        const outputDirectory = path.resolve(
          vite_internal_options.root,
          outputOptions.dir ??
            (outputOptions.file
              ? path.dirname(outputOptions.file)
              : vite_internal_options.outDir)
        );
        const resolvedEnvironmentName =
          environmentName ??
          [...environmentMetadata.entries()].find(
            ([, metadata]) => metadata.outputDir === outputDirectory
          )?.[0] ??
          (environmentNames.length === 1 ? environmentNames[0] : undefined);
        const coordinateWithBuildApp = supportsBuildApp && !isWatchMode;
        if (coordinateWithBuildApp && !resolvedEnvironmentName) {
          throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
            message: `Could not associate Vite output directory "${outputDirectory}" with an environment.`,
          });
        }
        let assetPrefix: string | undefined;
        if (
          coordinateWithBuildApp &&
          isMultiEnvironment &&
          !preservesLockedArtifactPaths
        ) {
          if (!sharedOutputRoot) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message: 'Could not determine a shared output root for Vite environments.',
            });
          }
          const relativeOutput = path.relative(sharedOutputRoot, outputDirectory);
          if (
            relativeOutput === '..' ||
            relativeOutput.startsWith(`..${path.sep}`) ||
            path.isAbsolute(relativeOutput)
          ) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message: `Vite environment output "${outputDirectory}" is outside shared output root "${sharedOutputRoot}".`,
            });
          }
          assetPrefix = relativeOutput
            ? relativeOutput.split(path.sep).join('/')
            : undefined;
        }
        const extractionOptions: ZephyrInternalOptions = {
          ...vite_internal_options,
          dir: outputOptions.dir,
          outDir: outputDirectory,
          assets: bundle,
          // Public files belong to the browser output in an SSR build. Loading them for
          // every server/RSC compiler creates duplicate paths and needless hashing.
          publicDir:
            isMultiEnvironment &&
            resolvedEnvironmentName &&
            environmentMetadata.get(resolvedEnvironmentName)?.consumer === 'server'
              ? undefined
              : vite_internal_options.publicDir,
        };

        let assetsMap = await extract_vite_assets_map(zephyr_engine, extractionOptions);

        if (coordinateWithBuildApp) {
          if (!resolvedEnvironmentName) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message: `Could not associate Vite output directory "${outputDirectory}" with an environment.`,
            });
          }
          const persistedAssetsMap = preservesLockedArtifactPaths
            ? assetsMap
            : prefixAssetsMap(assetsMap, assetPrefix);
          await savePartialAssetMap(
            zephyr_engine.application_uid,
            viteEnvironmentOutputKey(
              resolvedEnvironmentName,
              outputDirectory,
              outputOptions.file,
              outputOptions.format,
              persistedAssetsMap
            ),
            persistedAssetsMap,
            {
              invocationId: buildInvocationId,
              generation: buildGeneration,
            }
          );
          return;
        }

        if (!isWatchMode && externalPartialScope) {
          const batch = await claimPartialAssetMapBatch(zephyr_engine.application_uid, [
            externalPartialScope,
          ]);
          if (!batch) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message:
                'Vite partialBuild was configured, but its external partial output was unavailable or already claimed.',
            });
          }
          partialClaims.push(...batch.claims);
          const partials = mergeClaimedPartialMaps(partialClaims);
          assetsMap = mergeAssetMaps([...Object.values(partials), assetsMap]);
        }

        if (!zephyr_engine.hasActiveBuild) {
          await zephyr_engine.start_new_build();
        }
        const federationMetadata = getModuleFederationPublicationMetadata();
        assertTapFederationPublicationMetadata({
          target: options.target,
          mfConfigs: federationMetadata.mfConfigs,
          federation: federationMetadata.federation,
        });
        await zephyr_engine.upload_assets({
          assetsMap,
          buildStats: attachViteFederationBuildStats(
            await zeBuildDashData(zephyr_engine),
            federationMetadata
          ),
          mfConfig: federationMetadata.mfConfig,
          mfConfigs: federationMetadata.mfConfigs,
          hooks,
          entrypoint,
          snapshotType: options.snapshotType ?? 'csr',
        });

        await zephyr_engine.build_finished();
        await commitPartialAssetMapClaimBatch(
          zephyr_engine.application_uid,
          partialClaims.map(({ claimId }) => claimId)
        );
      } catch (error) {
        try {
          const zephyr_engine = await zephyr_engine_defer;
          zephyr_engine.build_failed();
        } catch {
          // Engine initialization failed before any reusable build state existed.
        }
        if (partialClaims.length > 0) {
          try {
            const zephyr_engine = await zephyr_engine_defer;
            await rollbackPartialAssetMapClaimBatch(
              zephyr_engine.application_uid,
              partialClaims.map(({ claimId }) => claimId)
            );
          } catch (restoreError) {
            handleGlobalError(restoreError);
          }
        }
        handleGlobalError(error);
      }
    },

    buildApp: {
      order: 'post',
      async handler(builder) {
        if (!supportsBuildApp) {
          return;
        }

        const environments = Object.entries(builder.environments);
        if (isWatchMode) {
          if (environments.length > 1) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message:
                'Vite multi-environment watch publication is not supported because ' +
                'environment rebuilds do not expose an atomic application generation.',
            });
          }
          return;
        }
        if (environments.length === 0) {
          throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
            message: 'Vite exposed no build environments for Zephyr publication.',
          });
        }

        let incomplete = environments
          .filter(([, environment]) => !environment.isBuilt)
          .map(([name]) => name);
        // In Vite's default builder, fallback environment compilation happens after
        // plugin buildApp hooks. If no framework has claimed any environment, this post
        // hook owns orchestration and must build them before collecting partial output.
        if (incomplete.length === environments.length) {
          for (const [, environment] of environments) {
            await builder.build(environment);
          }
          incomplete = environments
            .filter(([, environment]) => !environment.isBuilt)
            .map(([name]) => name);
        }
        if (incomplete.length > 0) {
          throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
            message:
              `Vite completed without these environments: ${incomplete.join(', ')}. ` +
              'Zephyr will not publish partial compiler output.',
          });
        }

        const partialClaims: PartialAssetMapClaim[] = [];
        const generation = buildGeneration++;
        try {
          const zephyrEngine = await zephyr_engine_defer;
          zephyrEngine.buildProperties.baseHref = baseHref;
          const claimScopes = [
            { invocationId: buildInvocationId, generation },
            ...(externalPartialScope ? [externalPartialScope] : []),
          ];
          const batch = await claimPartialAssetMapBatch(
            zephyrEngine.application_uid,
            claimScopes
          );
          if (!batch) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message: externalPartialScope
                ? 'Vite could not atomically claim both environment and configured external partial output.'
                : 'Vite environment output was unavailable or already claimed.',
            });
          }
          partialClaims.push(...batch.claims);
          const claimedPartials = mergeClaimedPartialMaps(partialClaims);
          if (Object.keys(claimedPartials).length === 0) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message: 'Vite produced no environment assets for Zephyr publication.',
            });
          }

          const expectedEnvironmentNames = new Set(environments.map(([name]) => name));
          const environmentOutputCounts = new Map<string, number>(
            environments.map(([name]) => [name, 0] as const)
          );
          const unexpectedEnvironmentOutputs: string[] = [];
          for (const key of Object.keys(claimedPartials)) {
            if (!key.startsWith(VITE_ENVIRONMENT_OUTPUT_PREFIX)) continue;
            const environmentName = parseViteEnvironmentOutputName(key);
            if (!environmentName || !expectedEnvironmentNames.has(environmentName)) {
              unexpectedEnvironmentOutputs.push(key);
              continue;
            }
            environmentOutputCounts.set(
              environmentName,
              (environmentOutputCounts.get(environmentName) ?? 0) + 1
            );
          }
          const missingEnvironmentOutputs = environments
            .map(([name]) => name)
            .filter((name) => environmentOutputCounts.get(name) === 0)
            .map(viteEnvironmentOutputPrefix);
          if (missingEnvironmentOutputs.length > 0) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message: `Vite did not produce Zephyr output for: ${missingEnvironmentOutputs.join(', ')}`,
            });
          }
          if (unexpectedEnvironmentOutputs.length > 0) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message:
                'Vite found stale or unexpected environment output for: ' +
                unexpectedEnvironmentOutputs.join(', '),
            });
          }

          const serverEnvironmentNames = environments
            .filter(
              ([name, environment]) =>
                (environment as { config?: { consumer?: string } }).config?.consumer ===
                  'server' || environmentMetadata.get(name)?.consumer === 'server'
            )
            .map(([name]) => name);
          const inferredSsr = serverEnvironmentNames.length > 0;
          // A TAP package can emit a desktop entry beside a QuickJS/worker target.
          // Those are SDK-owned package artifacts, not an inferred Zephyr server entry.
          const snapshotType =
            options.snapshotType ??
            (!preservesLockedArtifactPaths && inferredSsr ? 'ssr' : 'csr');
          const finalEntrypoint =
            snapshotType === 'ssr'
              ? inferServerEntrypoint(
                  claimedPartials,
                  options.entrypoint,
                  serverEnvironmentNames
                )
              : preservesLockedArtifactPaths
                ? undefined
                : (options.entrypoint ?? entrypoint);
          if (snapshotType === 'ssr' && !finalEntrypoint) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message:
                'Could not infer a Vite server entrypoint. Set withZephyr({ entrypoint }).',
            });
          }
          if (
            snapshotType === 'ssr' &&
            finalEntrypoint &&
            !Object.values(claimedPartials).some((assetsMap) =>
              Object.values(assetsMap).some((asset) => asset.path === finalEntrypoint)
            )
          ) {
            throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
              message: `Vite server entrypoint "${finalEntrypoint}" was not emitted in the coordinated snapshot.`,
            });
          }
          uploadMetadata = { snapshotType, entrypoint: finalEntrypoint };

          applicationContext ??= new ApplicationContext({
            applicationUid: zephyrEngine.application_uid,
            prepare: () =>
              zephyrEngine.hasActiveBuild ? undefined : zephyrEngine.start_new_build(),
            publish: async ({ assetsMap }) => {
              if (!uploadMetadata) {
                throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
                  message: 'Vite upload metadata was not prepared.',
                });
              }
              const federationMetadata = getModuleFederationPublicationMetadata();
              assertTapFederationPublicationMetadata({
                target: options.target,
                mfConfigs: federationMetadata.mfConfigs,
                federation: federationMetadata.federation,
              });
              await zephyrEngine.upload_assets({
                assetsMap,
                buildStats: attachViteFederationBuildStats(
                  await zeBuildDashData(zephyrEngine),
                  federationMetadata
                ),
                mfConfig: federationMetadata.mfConfig,
                mfConfigs: federationMetadata.mfConfigs,
                hooks,
                snapshotType: uploadMetadata.snapshotType,
                entrypoint: uploadMetadata.entrypoint,
              });
            },
            finish: () => zephyrEngine.build_finished(),
            onFailure: () => zephyrEngine.build_failed(),
          });

          const outputParticipant = uniqueParticipant(
            'vite-output',
            environments.map(([name]) => name)
          );
          const session = applicationContext.beginBuild({
            invocationId: `${buildInvocationId}:${generation}`,
            generation,
            // TAP descriptors bind the exact asset path into their hash. Do not let the
            // shared session repair aliases, because repairing them would require a
            // different asset hash than the SDK supplied.
            strictAssetPaths: preservesLockedArtifactPaths,
            participants: [
              ...environments.map(([name, environment]) => ({
                name,
                role:
                  (environment as { config?: { consumer?: string } }).config?.consumer ??
                  environmentMetadata.get(name)?.consumer ??
                  name,
              })),
              { name: outputParticipant, role: snapshotType },
            ],
          });
          for (const [name] of environments) {
            session.completeParticipant(name);
          }
          for (const [key, assetsMap] of Object.entries(claimedPartials)) {
            session.contribute({ participant: outputParticipant, key, assetsMap });
          }
          session.completeParticipant(outputParticipant);
          await session.publish();
          await commitPartialAssetMapClaimBatch(
            zephyrEngine.application_uid,
            partialClaims.map(({ claimId }) => claimId)
          );
        } catch (error) {
          try {
            const zephyrEngine = await zephyr_engine_defer;
            zephyrEngine.build_failed();
          } catch {
            // Engine initialization failed before any reusable build state existed.
          }
          if (partialClaims.length > 0) {
            try {
              const zephyrEngine = await zephyr_engine_defer;
              await rollbackPartialAssetMapClaimBatch(
                zephyrEngine.application_uid,
                partialClaims.map(({ claimId }) => claimId)
              );
            } catch (restoreError) {
              handleGlobalError(restoreError);
            }
          }
          handleGlobalError(error);
        }
      },
    },
  };
}

export function withZephyr(options: WithZephyrOptions = {}): Plugin[] {
  if (options.target !== undefined) {
    assertZephyrBuildTarget(options.target, 'withZephyr({ target })');
  }
  const plugins: Plugin[] = [];

  const mfConfigs = toModuleFederationConfigArray(options.mfConfig);
  if (mfConfigs.length > 0) {
    const federation = loadModuleFederationPlugin();
    const preservesLockedArtifactPaths = options.target === 'tap-app';
    for (const mfConfig of mfConfigs) {
      plugins.push(
        ...federation(
          preservesLockedArtifactPaths
            ? mfConfig
            : ensureRuntimePlugin(mfConfig, options.zephyrManifestUrl)
        )
      );
    }
  }

  plugins.push(withZephyrCore(options));
  return plugins;
}
