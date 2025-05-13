import type { NormalizedOutputOptions, OutputBundle } from 'rollup';
import type { ResolvedConfig } from 'vite';
import { logFn, savePartialAssetMap, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map';
import { extractViteBuildStats } from './internal/extract/extract_vite_build_stats';
import type { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';

export function withZephyrPartial() {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  let resolve_vite_internal_options: (value: ZephyrInternalOptions) => void;
  const vite_internal_options_defer = new Promise<ZephyrInternalOptions>((resolve) => {
    resolve_vite_internal_options = resolve;
  });

  let outputBundle: OutputBundle | undefined;

  return {
    name: 'with-zephyr-partial',
    apply: 'build',
    enforce: 'post',
    configResolved: async (config: ResolvedConfig) => {
      zephyr_defer_create({
        builder: 'vite',
        context: config.root,
      });
      resolve_vite_internal_options({
        root: config.root,
        configFile: config.configFile,
        outDir: config.build.outDir,
        publicDir: config.publicDir,
      });
    },
    writeBundle: async (opts: NormalizedOutputOptions, bundle: OutputBundle) => {
      outputBundle = bundle;
      const vite_internal_options = await vite_internal_options_defer;
      vite_internal_options.dir = opts.dir;
      vite_internal_options.assets = bundle;
    },

    closeBundle: async () => {
      try {
        const vite_internal_options = await vite_internal_options_defer;
        const zephyr_engine = await zephyr_engine_defer;
        const application_uid = zephyr_engine.application_uid;
        // context import ^
        const assetsMap = await extract_vite_assets_map(
          zephyr_engine,
          vite_internal_options
        );
        await savePartialAssetMap(
          application_uid,
          vite_internal_options.configFile ?? 'partial',
          assetsMap
        );

        // Enable deployment for partial builds if requested
        await zephyr_engine.start_new_build();

        // Generate enhanced build stats for Vite
        const buildStats = await extractViteBuildStats({
          zephyr_engine,
          bundle: outputBundle || {},
          root: vite_internal_options.root,
        });

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
