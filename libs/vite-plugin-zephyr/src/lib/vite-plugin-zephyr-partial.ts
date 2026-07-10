import * as path from 'node:path';
import type { Plugin, ResolvedConfig } from 'vite' with {
  'resolution-mode': 'import',
};
import {
  handleGlobalError,
  savePartialAssetMap,
  ZeErrors,
  ZephyrEngine,
  ZephyrError,
  type PartialAssetMapScope,
} from 'zephyr-agent';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map';
import {
  requireVitePartialBuildScope,
  type VitePartialBuildOptions,
} from './internal/partial-build-scope';
import type { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';

export function withZephyrPartial(options: VitePartialBuildOptions = {}): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  let partialScope: PartialAssetMapScope | undefined;

  let resolve_vite_internal_options: (value: ZephyrInternalOptions) => void;
  const vite_internal_options_defer = new Promise<ZephyrInternalOptions>((resolve) => {
    resolve_vite_internal_options = resolve;
  });

  return {
    name: 'with-zephyr-partial',
    apply: 'build',
    enforce: 'post',
    configResolved: async (config: ResolvedConfig) => {
      // Resolve only for build-mode plugin activation so dev config loading remains safe.
      partialScope = requireVitePartialBuildScope(options);
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
    // writeBundle is called after files are written to disk - safe to read from filesystem
    writeBundle: async function (options, bundle) {
      const baseOptions = await vite_internal_options_defer;
      const environmentName = (this as unknown as { environment?: { name?: string } })
        .environment?.name;
      const outputDir = path.resolve(
        baseOptions.root,
        options.dir ?? (options.file ? path.dirname(options.file) : baseOptions.outDir)
      );
      const vite_internal_options: ZephyrInternalOptions = {
        ...baseOptions,
        dir: options.dir,
        outDir: outputDir,
        assets: bundle,
      };

      // Extract and save assets after bundle is written to disk
      try {
        if (!partialScope) {
          throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
            message: 'Vite partial build scope was not resolved before writeBundle.',
          });
        }
        const zephyr_engine = await zephyr_engine_defer;
        const application_uid = zephyr_engine.application_uid;
        const assetsMap = await extract_vite_assets_map(
          zephyr_engine,
          vite_internal_options
        );
        await savePartialAssetMap(
          application_uid,
          [
            'vite-partial',
            vite_internal_options.configFile ?? 'partial',
            environmentName ?? 'default',
            outputDir.replace(/\\/g, '/'),
          ].join(':'),
          assetsMap,
          partialScope
        );

        // todo: initially partial build doesn't have deploy, but code below could enable it if needed
        // await zephyr_engine.upload_assets({
        //   assetsMap,
        //   // todo: this should be updated if we have remotes
        //   buildStats: await zeBuildDashData(zephyr_engine),
        // });
      } catch (error) {
        handleGlobalError(error);
      }
    },
  };
}
