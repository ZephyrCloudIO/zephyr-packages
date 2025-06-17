import { federation } from '@module-federation/vite';
import type { Plugin, ResolvedConfig } from 'vite';
import { logFn, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import type {
  XFederatedConfig,
  XOutputAsset,
  XOutputBundle,
  XOutputChunk,
} from 'zephyr-rollx-internal';
import {
  extract_mf_plugin,
  extract_remotes_dependencies,
  extractMFConfig,
  extractRollxBuildStats,
  getRollxAssetsMap,
  load_resolved_remotes,
} from 'zephyr-rollx-internal';
import type { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';

interface VitePluginZephyrOptions {
  mfConfig?: XFederatedConfig;
}

export function withZephyr(_options?: VitePluginZephyrOptions): Plugin[] {
  const mfConfig = _options?.mfConfig;
  const plugins: Plugin[] = [];
  if (mfConfig) {
    plugins.push(...(federation(mfConfig) as Plugin[]));
  }
  plugins.push(zephyrPlugin(_options));
  return plugins;
}

function zephyrPlugin(_options?: VitePluginZephyrOptions): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  // const mfConfig = _options?.mfConfig;

  let resolve_vite_internal_options: (value: ZephyrInternalOptions) => void;
  const vite_internal_options_defer = new Promise<ZephyrInternalOptions>((resolve) => {
    resolve_vite_internal_options = resolve;
  });
  let root: string;
  let outputBundle: XOutputBundle | undefined;

  let baseHref = '/';
  let mf_config: XFederatedConfig | undefined;

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
      mf_config = extract_mf_plugin(config.plugins as any) || undefined;
    },

    transform: async (code, id) => {
      try {
        if (!id.includes('virtual:mf-REMOTE_ENTRY_ID') || !mf_config) return code;

        const mfConfig = extractMFConfig(mf_config);
        if (!mfConfig) return code;

        const dependencyPairs = extract_remotes_dependencies(mfConfig);
        // Handle dependency resolution
        if (!dependencyPairs || dependencyPairs.length === 0) return code;

        const zephyr_engine = await zephyr_engine_defer;
        const resolved_remotes =
          await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

        if (!resolved_remotes) return code;

        return load_resolved_remotes(code, resolved_remotes);
      } catch (error) {
        logFn('error', ZephyrError.format(error));
        // returns the original code in case of error
        return code;
      }
    },
    // Capture the output bundle for build stats generation
    writeBundle: (_, bundle: XOutputBundle<XOutputAsset | XOutputChunk>) => {
      outputBundle = bundle;
    },
    closeBundle: async () => {
      try {
        const [vite_internal_options, zephyr_engine] = await Promise.all([
          vite_internal_options_defer,
          zephyr_engine_defer,
        ]);

        zephyr_engine.buildProperties.baseHref = baseHref;

        await zephyr_engine.start_new_build();
        const assetsMap = await getRollxAssetsMap(outputBundle || {});

        // Generate enhanced build stats for Vite using the discovered remote imports
        const buildStats = await extractRollxBuildStats({
          zephyr_engine,
          bundle: outputBundle || {},
          mfConfig: _options?.mfConfig,
          root,
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
