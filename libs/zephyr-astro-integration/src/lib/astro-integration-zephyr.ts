import type { AstroIntegration, HookParameters } from 'astro';
import { fileURLToPath } from 'node:url';
import {
  catchAsync,
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
        const contextPath = fileURLToPath(config.root);
        zephyr_defer_create({
          builder: 'astro',
          context: contextPath,
        });
      },
      'astro:build:done': async ({
        dir,
        ...params
      }: HookParameters<'astro:build:done'>) => {
        await catchAsync(async () => {
          const zephyr_engine = await zephyr_engine_defer;
          const outputPath = fileURLToPath(dir);

          zephyr_engine.buildProperties.output = outputPath;
          await zephyr_engine.start_new_build();

          const assets = (params as AstroBuildDoneParams).assets;
          const assetsMap = await extractAstroAssetsFromBuildHook(assets, outputPath);

          await zephyr_engine.upload_assets({
            assetsMap,
            buildStats: await zeBuildDashData(zephyr_engine),
            hooks,
          });

          await zephyr_engine.build_finished();
        });
      },
    },
  };
}
