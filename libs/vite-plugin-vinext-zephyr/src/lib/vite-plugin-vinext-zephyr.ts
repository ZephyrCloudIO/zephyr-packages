import * as path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite' with {
  'resolution-mode': 'import',
};
import {
  ApplicationContext,
  assertZephyrBuildTarget,
  buildAssetsMap,
  handleGlobalError,
  zeBuildDashData,
  ZeErrors,
  ZephyrEngine,
  type ZephyrBuildHooks,
  type ZephyrBuildTarget,
  type ZephyrLegacyModuleFederationConfig,
  type ZephyrModuleFederationBuildMetadata,
  type ZephyrModuleFederationConfig,
  ZephyrError,
  ze_log,
} from 'zephyr-agent';
import {
  collectOutputDirectoryAssets,
  detectEntrypointFromAssets,
  injectRscAssetsManifest,
  resolveVinextEntrypoint,
  type RscPluginManagerLike,
  type VinextBuildAsset,
} from './internal/vinext-output';

export interface VinextZephyrOptions {
  /** Zephyr artifact family, including `tap-app` for TAP packages. */
  target?: ZephyrBuildTarget;
  /** Every independently published Module Federation container. */
  mfConfigs?: ZephyrModuleFederationConfig[];
  /** Build-stat metadata paired with `mfConfigs`. */
  federation?: ZephyrModuleFederationBuildMetadata[];
  /** Build output directory (default: dist relative to Vite root). */
  outputDir?: string;
  /** TAP defaults to CSR; set `ssr` to require an SSR entrypoint upload. */
  snapshotType?: 'csr' | 'ssr';
  /** Optional server entrypoint override, relative to outputDir for SSR snapshots. */
  entrypoint?: string;
  /** Optional Zephyr upload lifecycle hooks. */
  hooks?: ZephyrBuildHooks;
}

function resolveOutputDir(root: string, outputDir?: string): string {
  if (!outputDir) {
    return path.join(root, 'dist');
  }

  return path.isAbsolute(outputDir) ? outputDir : path.resolve(root, outputDir);
}

function getRscPluginManager(config: ResolvedConfig): RscPluginManagerLike | undefined {
  const plugin = config.plugins.find((item) => item?.name === 'rsc:minimal') as
    | { api?: { manager?: RscPluginManagerLike } }
    | undefined;

  return plugin?.api?.manager;
}

function resolveSnapshotType(options: VinextZephyrOptions): 'csr' | 'ssr' {
  return options.snapshotType ?? (options.target === 'tap-app' ? 'csr' : 'ssr');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * TAP has no framework-owned Module Federation metadata source. Require callers to
 * provide the complete, paired snapshot and dashboard records rather than publishing a
 * package that the control plane cannot address deterministically.
 */
function assertTapFederationMetadata(options: VinextZephyrOptions): void {
  if (options.target !== 'tap-app') {
    return;
  }

  const { mfConfigs, federation } = options;
  if (!Array.isArray(mfConfigs) || mfConfigs.length === 0) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: 'tap-app metadata must include a non-empty mfConfigs array.',
    });
  }
  if (!Array.isArray(federation) || federation.length === 0) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message: 'tap-app metadata must include a non-empty federation array.',
    });
  }
  if (mfConfigs.length !== federation.length) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
      message:
        'tap-app metadata must include the same number of mfConfigs and federation entries.',
    });
  }

  const federationByName = new Map<string, ZephyrModuleFederationBuildMetadata>();
  const federationRemotes = new Set<string>();
  for (const entry of federation) {
    const { name, remote } = entry;
    if (!isNonEmptyString(name) || !isNonEmptyString(remote)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          'tap-app federation metadata entries must each include a non-empty name and remote.',
      });
    }
    if (federationByName.has(name) || federationRemotes.has(remote)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          'tap-app federation metadata entries must have unique names and remotes.',
      });
    }
    federationByName.set(name, entry);
    federationRemotes.add(remote);
  }

  const configNames = new Set<string>();
  const configFilenames = new Set<string>();
  for (const config of mfConfigs) {
    const { name, filename } = config;
    if (!isNonEmptyString(name) || !isNonEmptyString(filename)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          'tap-app mfConfigs entries must each include a non-empty name and filename.',
      });
    }
    if (configNames.has(name) || configFilenames.has(filename)) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message: 'tap-app mfConfigs entries must have unique names and filenames.',
      });
    }
    configNames.add(name);
    configFilenames.add(filename);

    const federationEntry = federationByName.get(name);
    if (!federationEntry || federationEntry.remote !== filename) {
      throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
        message:
          `tap-app metadata must pair mfConfigs entry ${JSON.stringify(name)} with a ` +
          `federation entry using remote ${JSON.stringify(filename)}.`,
      });
    }
  }
}

/**
 * Old consumers only understand one complete container. Keep that compatibility field
 * unambiguous while always retaining the full typed `mfConfigs` array for TAP.
 */
function getLegacyModuleFederationConfig(
  mfConfigs: readonly ZephyrModuleFederationConfig[] | undefined
): ZephyrLegacyModuleFederationConfig | undefined {
  const config = mfConfigs?.length === 1 ? mfConfigs[0] : undefined;
  if (
    !config ||
    typeof config.name !== 'string' ||
    !config.name.trim() ||
    typeof config.filename !== 'string' ||
    !config.filename.trim()
  ) {
    return undefined;
  }

  return config as ZephyrLegacyModuleFederationConfig;
}

export function withZephyrVinext(options: VinextZephyrOptions = {}): Plugin {
  if (options.target !== undefined) {
    assertZephyrBuildTarget(options.target, 'withZephyrVinext({ target })');
  }
  assertTapFederationMetadata(options);

  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const snapshotType = resolveSnapshotType(options);
  let resolvedConfig: ResolvedConfig | undefined;
  let outputDir = '';
  let rscPluginManager: RscPluginManagerLike | undefined;
  let engineCreated = false;
  let buildGeneration = 0;
  let applicationContext: ApplicationContext | undefined;
  let uploadEntrypoint: string | undefined;

  async function ensureEngine() {
    if (!engineCreated) {
      if (!resolvedConfig) {
        throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
          message: 'Vite config was not resolved before Zephyr upload.',
        });
      }

      zephyr_defer_create({
        builder: 'vite',
        context: resolvedConfig.root,
        ...(options.target === undefined ? {} : { target: options.target }),
      });
      engineCreated = true;
    }

    return zephyr_engine_defer;
  }

  return {
    name: 'vite-plugin-vinext-zephyr',
    apply: 'build',
    enforce: 'post',

    configResolved(config) {
      resolvedConfig = config;
      outputDir = resolveOutputDir(config.root, options.outputDir);
      rscPluginManager = getRscPluginManager(config);
    },

    buildApp: {
      // Vinext's RSC manifest is finalized by framework buildApp hooks. Publish only
      // after those hooks and every child environment have completed.
      order: 'post',
      async handler(builder) {
        const environments = Object.entries(builder.environments);
        if (environments.length === 0) {
          throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
            message: 'Vinext exposed no build environments for publication.',
          });
        }
        const incomplete = environments
          .filter(([, environment]) => !environment.isBuilt)
          .map(([name]) => name);
        if (incomplete.length > 0) {
          throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
            message:
              `Vinext completed without these environments: ${incomplete.join(', ')}. ` +
              'Zephyr will not publish a partial RSC/SSR deployment.',
          });
        }

        try {
          const zephyrEngine = await ensureEngine();
          const generation = buildGeneration++;
          const assets: Record<string, VinextBuildAsset> = {};
          const outputCollectionOptions = { target: options.target };
          await collectOutputDirectoryAssets(assets, outputDir, outputCollectionOptions);
          injectRscAssetsManifest(
            assets,
            outputDir,
            rscPluginManager,
            outputCollectionOptions
          );

          if (snapshotType === 'ssr') {
            const detectedEntrypoint = detectEntrypointFromAssets(assets);
            const entrypoint = resolveVinextEntrypoint(
              outputDir,
              detectedEntrypoint,
              options.entrypoint
            );
            if (!assets[entrypoint]) {
              throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
                message: `Vinext server entrypoint "${entrypoint}" was not emitted under "${outputDir}".`,
              });
            }
            uploadEntrypoint = entrypoint;
          } else {
            uploadEntrypoint = undefined;
          }

          applicationContext ??= new ApplicationContext({
            applicationUid: zephyrEngine.application_uid,
            prepare: ({ generation: nextGeneration }) =>
              nextGeneration === 0 ? undefined : zephyrEngine.start_new_build(),
            publish: async ({ assetsMap }) => {
              if (snapshotType === 'ssr' && !uploadEntrypoint) {
                throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
                  message: 'Vinext upload metadata was not prepared.',
                });
              }
              // Options can be held by a user-owned config object until the framework
              // finishes. Revalidate immediately before transport so a later mutation
              // cannot turn a valid TAP setup into an incomplete publication.
              assertTapFederationMetadata(options);
              const buildStats = await zeBuildDashData(zephyrEngine);
              const mfConfig = getLegacyModuleFederationConfig(options.mfConfigs);
              await zephyrEngine.upload_assets({
                assetsMap,
                buildStats:
                  options.federation === undefined
                    ? buildStats
                    : { ...buildStats, federation: options.federation },
                ...(mfConfig ? { mfConfig } : {}),
                ...(options.mfConfigs === undefined
                  ? {}
                  : { mfConfigs: options.mfConfigs }),
                snapshotType,
                ...(snapshotType === 'ssr' ? { entrypoint: uploadEntrypoint } : {}),
                hooks: options.hooks,
              });
            },
            finish: () => zephyrEngine.build_finished(),
            onFailure: () => zephyrEngine.build_failed(),
          });

          let outputParticipant = 'vinext-output';
          let participantSuffix = 1;
          const environmentNames = new Set(environments.map(([name]) => name));
          while (environmentNames.has(outputParticipant)) {
            outputParticipant = `vinext-output-${participantSuffix++}`;
          }
          const session = applicationContext.beginBuild({
            invocationId: `vinext-${generation}`,
            generation,
            participants: [
              ...environments.map(([name]) => ({ name, role: name })),
              { name: outputParticipant, role: snapshotType },
            ],
            postprocessors: ['vinext-rsc-manifest'],
            strictAssetPaths: options.target === 'tap-app',
          });
          for (const [name] of environments) {
            session.completeParticipant(name);
          }
          session.contribute({
            participant: outputParticipant,
            key: outputDir,
            assetsMap: buildAssetsMap(
              assets,
              (asset) => asset.content,
              (asset) => asset.type
            ),
          });
          session.completeParticipant(outputParticipant);
          session.completePostprocess('vinext-rsc-manifest');

          ze_log.upload(
            `Uploading Vinext build (${Object.keys(assets).length} assets, snapshotType: ${snapshotType})`
          );
          await session.publish();
        } catch (error) {
          if (engineCreated) {
            try {
              const zephyrEngine = await zephyr_engine_defer;
              zephyrEngine.build_failed();
            } catch {
              // Engine initialization failed before any reusable build state existed.
            }
          }
          handleGlobalError(error);
        }
      },
    },
  };
}
