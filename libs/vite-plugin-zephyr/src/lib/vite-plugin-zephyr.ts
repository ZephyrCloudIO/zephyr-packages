import type { Plugin, ResolvedConfig } from 'vite';
import { logFn, zeBuildDashData, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import type { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';
import { federation } from '@module-federation/vite';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map';
import { extract_remotes_dependencies } from './internal/mf-vite-etl/extract-mf-vite-remotes';
import { load_resolved_remotes } from './internal/mf-vite-etl/load_resolved_remotes';
import { extract_mf_plugin } from './internal/extract/extract_mf_plugin';

export type ModuleFederationOptions = Parameters<typeof federation>[0];

interface VitePluginZephyrOptions {
  mfConfig?: ModuleFederationOptions;
}

export function withZephyr(_options?: VitePluginZephyrOptions): Plugin[] {
  const mfConfig = _options?.mfConfig;
  const plugins: Plugin[] = [];
  if (mfConfig) {
    plugins.push(...(federation(mfConfig) as Plugin[]));
  }
  plugins.push(zephyrPlugin());
  return plugins;
}

function zephyrPlugin(): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  let resolve_vite_internal_options: (value: ZephyrInternalOptions) => void;
  const vite_internal_options_defer = new Promise<ZephyrInternalOptions>((resolve) => {
    resolve_vite_internal_options = resolve;
  });
  let root: string;

  let baseHref = '/';
  let mfPlugin: (Plugin & { _options: ModuleFederationOptions }) | undefined;

  return {
    name: 'with-zephyr',
    enforce: 'post',

    configResolved: async (config: ResolvedConfig) => {
      root = config.root;
      baseHref = config.base || '/';

      if (config.command === 'serve') return;

      zephyr_defer_create({
        builder: 'vite',
        context: config.root,
      });
      resolve_vite_internal_options({
        root: config.root,
        outDir: config.build?.outDir,
        publicDir: config.publicDir,
      });
      mfPlugin = extract_mf_plugin(config.plugins ?? []);
    },
    transform: async (code, id) => {
      try {
        if (!id.includes('virtual:mf-REMOTE_ENTRY_ID') || !mfPlugin) return code;

        const dependencyPairs = extract_remotes_dependencies(root, mfPlugin._options);
        if (!dependencyPairs) return code;

        const zephyr_engine = await zephyr_engine_defer;
        const resolved_remotes =
          await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

        if (!resolved_remotes) return code;

        return load_resolved_remotes(resolved_remotes, code);
      } catch (error) {
        logFn('error', ZephyrError.format(error));
        // returns the original code in case of error
        return code;
      }
    },
    closeBundle: async () => {
      try {
        const [vite_internal_options, zephyr_engine] = await Promise.all([
          vite_internal_options_defer,
          zephyr_engine_defer,
        ]);

        zephyr_engine.buildProperties.baseHref = baseHref;

        await zephyr_engine.start_new_build();
        const assetsMap = await extract_vite_assets_map(
          zephyr_engine,
          vite_internal_options
        );
        await zephyr_engine.upload_assets({
          assetsMap,
          buildStats: await zeBuildDashData(zephyr_engine),
        });
        await zephyr_engine.build_finished();
      } catch (error) {
        logFn('error', ZephyrError.format(error));
      }
    },
  };
}
