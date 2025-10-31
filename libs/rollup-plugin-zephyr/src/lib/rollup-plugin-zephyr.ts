import type { InputOptions, NormalizedOutputOptions, OutputBundle } from 'rollup';
import {
  logFn,
  zeBuildDashData,
  ZephyrEngine,
  ZephyrError,
  type ZephyrBuildHooks,
} from 'zephyr-agent';
import { getAssetsMap } from './transform/get-assets-map';
import { cwd } from 'node:process';

const getInputFolder = (options: InputOptions): string => {
  if (typeof options.input === 'string') return options.input;
  if (Array.isArray(options.input)) return options.input[0];
  if (typeof options.input === 'object') return Object.values(options.input)[0];
  return cwd();
};

export function withZephyr(options?: { hooks?: ZephyrBuildHooks }) {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const hooks = options?.hooks;

  return {
    name: 'with-zephyr',
    buildStart: async (options: InputOptions) => {
      const path_to_execution_dir = getInputFolder(options);
      zephyr_defer_create({
        builder: 'rollup',
        context: path_to_execution_dir,
      });
    },
    writeBundle: async (_options: NormalizedOutputOptions, bundle: OutputBundle) => {
      try {
        const zephyr_engine = await zephyr_engine_defer;

        // Start a new build
        await zephyr_engine.start_new_build();

        // Upload assets and finish the build
        await zephyr_engine.upload_assets({
          assetsMap: getAssetsMap(bundle),
          buildStats: await zeBuildDashData(zephyr_engine),
          hooks,
        });

        await zephyr_engine.build_finished();
      } catch (error) {
        logFn('error', ZephyrError.format(error));
      }
    },
  };
}
