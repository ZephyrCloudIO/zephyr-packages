import type { Plugin, ResolvedConfig } from 'vite';
import {
  ze_log,
  zeBuildDashData,
  ZephyrEngine,
  ZeResolvedDependency,
} from 'zephyr-agent';
import type { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map';
import { extract_remotes_dependencies } from './internal/mf-vite-etl/extract-mf-vite-remotes';
import { load_resolved_remotes } from './internal/mf-vite-etl/load_resolved_remotes';
import { federation } from '@module-federation/vite';
import { get_mf_config } from './internal/extract/get-mf-config';

export type ModuleFederationOptions = Parameters<typeof federation>[0];

interface VitePluginZephyrOptions {
  mfConfig?: ModuleFederationOptions;
}

export function withZephyr(_options?: VitePluginZephyrOptions): Plugin[] {
  const mfConfig = _options?.mfConfig;
  const plugins: Plugin[] = [];
  // keeping federation plugin here in case people don't know which plugin they should use and want to use zephyr to generate federation output (not recommended)
  if (mfConfig) {
    plugins.push(...(federation(mfConfig) as Plugin[]));
  }
  plugins.push(zephyrPlugin(_options));
  return plugins;
}

function zephyrPlugin(_options?: VitePluginZephyrOptions): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  let resolve_vite_internal_options: (value: ZephyrInternalOptions) => void;
  const vite_internal_options_defer = new Promise<ZephyrInternalOptions>((resolve) => {
    resolve_vite_internal_options = resolve;
  });
  let root: string;

  let mf_config: ModuleFederationOptions | undefined;

  let resolved_remotes: ZeResolvedDependency[] | null;

  return {
    name: 'with-zephyr',
    enforce: 'post',

    configResolved: async (config: ResolvedConfig) => {
      root = config.root;
      zephyr_defer_create(config.root);
      resolve_vite_internal_options({
        root: config.root,
        outDir: config.build?.outDir,
        publicDir: config.publicDir,
      });
      const zephyr_engine = await zephyr_engine_defer;

      // if no federation plugin found fallback to zephyr options
      mf_config = get_mf_config([...config.plugins]) ?? _options?.mfConfig;

      const dependencyPairs = extract_remotes_dependencies(mf_config, root);

      if (!dependencyPairs) return;
      resolved_remotes = await zephyr_engine.resolve_remote_dependencies(dependencyPairs);
      ze_log('dependency_pairs', dependencyPairs, 'resolved_remotes', resolved_remotes);
    },
    // be cautious of heavy actions under `transform` hook because every action will result in code scan again and again for each asset file
    transform: async (code, id) => {
      return load_resolved_remotes(resolved_remotes, code, id);
    },
    closeBundle: async () => {
      const vite_internal_options = await vite_internal_options_defer;
      const zephyr_engine = await zephyr_engine_defer;

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
    },
  };
}
