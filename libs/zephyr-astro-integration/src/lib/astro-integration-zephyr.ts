import type { AstroIntegration, HookParameters } from 'astro' with {
  'resolution-mode': 'import',
};
import { fileURLToPath } from 'node:url';
import {
  handleGlobalError,
  zeBuildDashData,
  ZephyrEngine,
  type ZephyrBuildHooks,
} from 'zephyr-agent';
import { extractAstroAssetsFromBuildHook } from './internal/extract-astro-assets-map';

type AstroBuildDoneParams = HookParameters<'astro:build:done'> & {
  assets?: Record<string, unknown> | Map<string, unknown> | Array<unknown>;
};

export interface ZephyrAstroOptions {
  hooks?: ZephyrBuildHooks;
}

export function withZephyr(options?: ZephyrAstroOptions): AstroIntegration {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const hooks = options?.hooks;

  return {
    name: 'with-zephyr',
    hooks: {
      'astro:config:done': async ({ config }: HookParameters<'astro:config:done'>) => {
        // config.root is a URL object, convert to file path
        const contextPath = fileURLToPath(config.root);
        // Initialize ZephyrEngine with Astro context
        zephyr_defer_create({
          builder: 'astro',
          context: contextPath,
        });
      },
      'astro:build:done': async ({
        dir,
        ...params
      }: HookParameters<'astro:build:done'>) => {
        let zephyr_engine: ZephyrEngine | undefined;
        let buildInProgress = false;
        try {
          zephyr_engine = await zephyr_engine_defer;
          // create() has already allocated generation zero.
          buildInProgress = true;

          // Convert URL to file system path
          const outputPath = fileURLToPath(dir);

          // Set output directory for ZephyrEngine
          zephyr_engine.buildProperties.output = outputPath;

          // Start a new build
          await zephyr_engine.start_new_build();

          // Extract assets from params if available (Astro v5+), fallback to filesystem walking
          const assets = (params as AstroBuildDoneParams).assets;
          const assetsMap = await extractAstroAssetsFromBuildHook(assets, outputPath);

          // Upload assets and build stats
          await zephyr_engine.upload_assets({
            assetsMap,
            buildStats: await zeBuildDashData(zephyr_engine),
            hooks,
          });

          // Mark build as finished
          buildInProgress = false;
          await zephyr_engine.build_finished();
        } catch (error) {
          handleGlobalError(error);
        } finally {
          if (buildInProgress && zephyr_engine?.hasActiveBuild !== false) {
            zephyr_engine?.build_failed();
          }
        }
      },
    },
  };
}
