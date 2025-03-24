import type { InputOptions, NormalizedOutputOptions, OutputBundle } from 'rollup';
import { zeBuildDashData, ZephyrEngine } from 'zephyr-agent';
import { normalizeBasePath } from 'zephyr-agent/src/lib/transformers/ze-basehref-handler';
import { getAssetsMap } from './transform/get-assets-map';
import { cwd } from 'node:process';

const getInputFolder = (options: InputOptions): string => {
  if (typeof options.input === 'string') return options.input;
  if (Array.isArray(options.input)) return options.input[0];
  if (typeof options.input === 'object') return Object.values(options.input)[0];
  return cwd();
};

/**
 * Options for Zephyr Rollup plugin
 */
export interface ZephyrRollupPluginOptions {
  /**
   * Base path for assets (optional)
   * Will override any base path from Rollup config
   */
  baseHref?: string;
}

export function withZephyr(options?: ZephyrRollupPluginOptions) {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const baseHref = options?.baseHref;

  return {
    name: 'with-zephyr',
    buildStart: async (rollupOptions: InputOptions) => {
      const path_to_execution_dir = getInputFolder(rollupOptions);
      zephyr_defer_create({
        builder: 'rollup',
        context: path_to_execution_dir,
      });
    },
    outputOptions: async (outputOptions: NormalizedOutputOptions) => {
      // Get the zephyr engine instance
      const zephyr_engine = await zephyr_engine_defer;

      // Process baseHref with plugin option having higher priority than Rollup config
      let baseToUse = outputOptions.dir;
      
      // If explicit baseHref is provided in plugin options, use it
      if (baseHref !== undefined) {
        baseToUse = baseHref;
      }
      
      // Normalize and store baseHref in ZephyrEngine
      if (baseToUse) {
        const normalizedBaseHref = normalizeBasePath(baseToUse);
        zephyr_engine.buildProperties.baseHref = normalizedBaseHref;
      }
      
      return outputOptions;
    },
    writeBundle: async (options: NormalizedOutputOptions, bundle: OutputBundle) => {
      const zephyr_engine = await zephyr_engine_defer;
      await zephyr_engine.start_new_build();
      await zephyr_engine.upload_assets({
        assetsMap: getAssetsMap(bundle, zephyr_engine),
        buildStats: await zeBuildDashData(zephyr_engine),
      });
      await zephyr_engine.build_finished();
    },
  };
}
