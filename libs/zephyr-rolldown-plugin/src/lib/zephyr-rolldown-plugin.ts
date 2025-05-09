import type { InputOptions, NormalizedOutputOptions, OutputBundle } from 'rolldown';
import { logFn, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import { cwd } from 'node:process';
import { getAssetsMap } from './internal/get-assets-map';
import { extractRolldownBuildStats } from './internal/extract-rolldown-build-stats';

export interface RolldownModuleFederationConfig {
  exposes: Record<string, string>;
  remotes: Record<string, string>;
  shared: Record<string, string>;
}

const getInputFolder = (options: InputOptions): string => {
  if (typeof options.input === 'string') return options.input;
  if (Array.isArray(options.input)) return options.input[0];
  if (typeof options.input === 'object') return Object.values(options.input)[0];
  return cwd();
};

interface ZephyrRolldownOptions {
  // Reserved for future options like module federation config if needed
  mfConfig?: RolldownModuleFederationConfig | undefined;
}

export function withZephyr(options?: ZephyrRolldownOptions) {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  return {
    name: 'with-zephyr',
    buildStart: async (inputOptions: InputOptions) => {
      const path_to_execution_dir = getInputFolder(inputOptions);
      zephyr_defer_create({
        builder: 'rolldown', // Now explicitly using 'rolldown' as the builder
        context: path_to_execution_dir,
      });
    },
    writeBundle: async (_options: NormalizedOutputOptions, bundle: OutputBundle) => {
      try {
        const zephyr_engine = await zephyr_engine_defer;

        // Start a new build
        await zephyr_engine.start_new_build();

        // Get assets map
        const assetsMap = getAssetsMap(bundle);

        // Generate enhanced build stats for Rolldown
        const buildStats = await extractRolldownBuildStats({
          zephyr_engine,
          bundle,
          mfConfig: options?.mfConfig,
        });

        // Upload assets and build stats
        await zephyr_engine.upload_assets({
          assetsMap,
          buildStats,
        });

        await zephyr_engine.build_finished();
      } catch (error) {
        logFn('error', ZephyrError.format(error));
      }
    },
  };
}
