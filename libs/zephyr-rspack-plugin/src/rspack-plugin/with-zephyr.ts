import type { Configuration as RspackConfiguration } from '@rspack/core';
import { handleGlobalError, ZephyrEngine } from 'zephyr-agent';
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
    // Log NX environment variables to see what's available
    const nxVars = Object.keys(process.env).filter(k => k.startsWith('NX_'));
    console.log('--------- NX env vars:', nxVars);
    console.log('NX_GRAPH_CREATION:', process.env['NX_GRAPH_CREATION']);
    console.log('NX_TASK_TARGET_TARGET:', process.env['NX_TASK_TARGET_TARGET']);

    // TEMPORARILY DISABLED TO SEE ENV VARS
    // Skip Zephyr execution during Nx graph calculation
    // NX_TASK_TARGET_TARGET is only set during actual task execution (build/serve)
    // if (!process.env['NX_TASK_TARGET_TARGET']) {
    //   return Promise.resolve(config);
    // }
    return _zephyr_configuration(config, zephyrPluginOptions);
  };
}

async function _zephyr_configuration(
  config: Configuration,
  _zephyrOptions?: ZephyrRspackPluginOptions
): Promise<Configuration> {
  try {
    // create instance of ZephyrEngine to track the application
    const zephyr_engine = await ZephyrEngine.create({
      builder: 'rspack',
      context: config.context,
    });

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
      })
    );
  } catch (error) {
    handleGlobalError(error);
  }

  return config;
}
