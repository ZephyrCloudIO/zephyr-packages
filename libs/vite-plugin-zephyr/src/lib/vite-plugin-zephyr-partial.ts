import type { NormalizedOutputOptions, OutputBundle } from 'rollup';
import type { ResolvedConfig } from 'vite';
import { savePartialAssetMap, ZephyrEngine } from 'zephyr-agent';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map';
import type { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';

export function withZephyrPartial() {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  let resolve_vite_internal_options: (value: ZephyrInternalOptions) => void;
  const vite_internal_options_defer = new Promise<ZephyrInternalOptions>((resolve) => {
    resolve_vite_internal_options = resolve;
  });

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
    writeBundle: async (options: NormalizedOutputOptions, bundle: OutputBundle) => {
      const vite_internal_options = await vite_internal_options_defer;
      vite_internal_options.dir = options.dir;
      vite_internal_options.assets = bundle;
    },

    closeBundle: async () => {
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
      // todo: initially partial build doesn't have deploy, but code below could enable it if needed
      // await zephyr_engine.upload_assets({
      //   assetsMap,
      //   // todo: this should be updated if we have remotes
      //   buildStats: await zeBuildDashData(zephyr_engine),
      // });
    },
  };
}
