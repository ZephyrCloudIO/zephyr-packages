import type { Configuration as RspackConfiguration } from '@rspack/core';
import { getGlobal, handleGlobalError, ZephyrEngine } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import type { ZephyrRspackPluginOptions } from '../types';
import { ZeRspackPlugin } from './ze-rspack-plugin';

export type Configuration = RspackConfiguration;

export function withZephyr(
  zephyrPluginOptions?: ZephyrRspackPluginOptions
): (config: Configuration) => Promise<Configuration> {
  return (config) => {
    // Skip Zephyr execution during Nx graph calculation
    // Nx sets global.NX_GRAPH_CREATION = true during graph creation
    if (getGlobal().NX_GRAPH_CREATION) {
      return Promise.resolve(config);
    }
    return _zephyr_configuration(config, zephyrPluginOptions);
  };
}

async function _zephyr_configuration(
  config: Configuration,
  _zephyrOptions?: ZephyrRspackPluginOptions
): Promise<Configuration> {
  try {
    // create instance of ZephyrEngine to track the application
    const zephyr_engine =
      _zephyrOptions?.zephyr_engine ??
      (await ZephyrEngine.create({
        builder: 'rspack',
        context: config.context,
      }));

    // Resolve dependencies and update the config
    const dependencyPairs = extractFederatedDependencyPairs(config);
    const resolved_dependency_pairs =
      await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

    mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

    // inject the ZephyrRspackPlugin
    config.plugins?.push(
      new ZeRspackPlugin({
        zephyr_engine,
        mfConfig: makeCopyOfModuleFederationOptions(config),
        wait_for_index_html: _zephyrOptions?.wait_for_index_html,
        hooks: _zephyrOptions?.hooks,
        disable_upload: _zephyrOptions?.disable_upload,
        snapshot_type: _zephyrOptions?.snapshot_type,
        entrypoint: _zephyrOptions?.entrypoint,
      })
    );
  } catch (error) {
    handleGlobalError(error);
  }

  return config;
}
