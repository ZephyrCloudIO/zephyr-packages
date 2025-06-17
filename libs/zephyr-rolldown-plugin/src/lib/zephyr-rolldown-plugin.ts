import { cwd } from 'node:process';
import type { InputOptions, NormalizedOutputOptions, Plugin } from 'rolldown';
import { logFn, ZephyrEngine, ZephyrError } from 'zephyr-agent';

import { federation } from '@module-federation/vite';
import {
  extract_mf_plugin,
  extract_remotes_dependencies,
  extractMFConfig,
  extractRollxBuildStats,
  load_resolved_remotes,
  type XFederatedConfig,
  type XOutputAsset,
  type XOutputBundle,
  type XOutputChunk,
} from 'zephyr-rollx-internal';
import { getAssetsMap } from './internal/get-assets-map';

const getInputFolder = (options: InputOptions): string => {
  if (typeof options.input === 'string') return options.input;
  if (Array.isArray(options.input)) return options.input[0];
  if (typeof options.input === 'object') return Object.values(options.input)[0];
  return cwd();
};

interface ZephyrRolldownOptions {
  mfConfig?: XFederatedConfig;
}

export function withZephyr(options?: ZephyrRolldownOptions): Plugin[] {
  const plugins: Plugin[] = [];
  if (options?.mfConfig) {
    console.log('mfConfig', options?.mfConfig);
    plugins.push(...(federation(options?.mfConfig) as Plugin[]));
  }
  plugins.push(zephyr_rolldown_plugin(options));
  return plugins;
}

export function zephyr_rolldown_plugin(options?: ZephyrRolldownOptions): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  let path_to_execution_dir: string;
  let mfPlugin: XFederatedConfig | null = null;

  return {
    name: 'with-zephyr',
    buildStart: async (inputOptions: InputOptions) => {
      path_to_execution_dir = getInputFolder(inputOptions);
      zephyr_defer_create({
        builder: 'rolldown', // Now explicitly using 'rolldown' as the builder
        context: path_to_execution_dir,
      });

      // Extract Module Federation plugin if present
      // For rolldown, plugins might be in different format, so we check both inputOptions and any passed plugins
      const allPlugins = [
        ...(Array.isArray(inputOptions.plugins) ? inputOptions.plugins : []),
        ...(options?.mfConfig
          ? [{ name: 'module-federation-rolldown', config: options.mfConfig }]
          : []),
      ];
      mfPlugin = extract_mf_plugin(allPlugins);
    },

    transform: async (code, id) => {
      try {
        // Handle Module Federation virtual modules for rolldown
        if ((!id.includes('virtual:mf-') && !id.includes('__federation_')) || !mfPlugin) {
          return null; // Let other plugins handle non-MF modules
        }

        const mfConfig = extractMFConfig(mfPlugin);
        if (!mfConfig) return null;

        const dependencyPairs = extract_remotes_dependencies(mfConfig);
        if (!dependencyPairs || dependencyPairs.length === 0) return null;

        const zephyr_engine = await zephyr_engine_defer;
        const resolved_remotes =
          await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

        if (!resolved_remotes) return null;

        return {
          code: load_resolved_remotes(code, resolved_remotes),
          map: null,
        };
      } catch (error) {
        logFn('error', ZephyrError.format(error));
        return null; // Return null to let the original code pass through
      }
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
        const buildStats = await extractRollxBuildStats({
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
