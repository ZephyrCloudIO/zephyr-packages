import * as path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite' with {
  'resolution-mode': 'import',
};
import {
  ApplicationContext,
  buildAssetsMap,
  handleGlobalError,
  zeBuildDashData,
  ZeErrors,
  ZephyrEngine,
  type ZephyrBuildHooks,
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
  /** Build output directory (default: dist relative to Vite root). */
  outputDir?: string;
  /** Optional server entrypoint override, relative to outputDir. */
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

export function withZephyrVinext(options: VinextZephyrOptions = {}): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
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
          await collectOutputDirectoryAssets(assets, outputDir);
          injectRscAssetsManifest(assets, outputDir, rscPluginManager);

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

          applicationContext ??= new ApplicationContext({
            applicationUid: zephyrEngine.application_uid,
            prepare: ({ generation: nextGeneration }) =>
              nextGeneration === 0 ? undefined : zephyrEngine.start_new_build(),
            publish: async ({ assetsMap }) => {
              if (!uploadEntrypoint) {
                throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
                  message: 'Vinext upload metadata was not prepared.',
                });
              }
              await zephyrEngine.upload_assets({
                assetsMap,
                buildStats: await zeBuildDashData(zephyrEngine),
                snapshotType: 'ssr',
                entrypoint: uploadEntrypoint,
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
              { name: outputParticipant, role: 'ssr' },
            ],
            postprocessors: ['vinext-rsc-manifest'],
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
            `Uploading Vinext build (${Object.keys(assets).length} assets, entrypoint: ${entrypoint})`
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
