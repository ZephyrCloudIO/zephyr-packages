import { cwd } from 'node:process';
import type { InputOptions, NormalizedOutputOptions } from 'rolldown';
import { logFn, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import type {
  XFederatedConfig,
  XOutputAsset,
  XOutputBundle,
  XOutputChunk,
} from 'zephyr-xpack-internal';
import { extractXViteBuildStats } from 'zephyr-xpack-internal';
import { getAssetsMap } from './internal/get-assets-map';

const getInputFolder = (options: InputOptions): string => {
  if (typeof options.input === 'string') return options.input;
  if (Array.isArray(options.input)) return options.input[0];
  if (typeof options.input === 'object') return Object.values(options.input)[0];
  return cwd();
};

interface ZephyrRolldownOptions {
  // Reserved for future options like module federation config if needed
  mfConfig?: XFederatedConfig | undefined;
}

export function withZephyr(options?: ZephyrRolldownOptions) {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  let path_to_execution_dir: string;

  return {
    name: 'with-zephyr',
    buildStart: async (inputOptions: InputOptions) => {
      path_to_execution_dir = getInputFolder(inputOptions);
      zephyr_defer_create({
        builder: 'rolldown', // Now explicitly using 'rolldown' as the builder
        context: path_to_execution_dir,
      });
    },
    writeBundle: async (
      _options: NormalizedOutputOptions,
      bundle: XOutputBundle<XOutputChunk | XOutputAsset>
    ) => {
      try {
        const zephyr_engine = await zephyr_engine_defer;

        // basehref support
        zephyr_engine.buildProperties.baseHref = _options.dir;

        // Start a new build
        await zephyr_engine.start_new_build();

        // Get assets map
        const assetsMap = getAssetsMap(bundle);

        // Generate enhanced build stats for Rolldown
        const buildStats = await extractXViteBuildStats({
          zephyr_engine,
          bundle,
          mfConfig: options?.mfConfig,
          root: path_to_execution_dir,
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
