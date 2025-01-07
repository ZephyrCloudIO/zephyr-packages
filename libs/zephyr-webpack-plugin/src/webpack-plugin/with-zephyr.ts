import { Configuration } from 'webpack';
import { ze_log, ZephyrEngine } from 'zephyr-agent';

import { ZeWebpackPlugin } from './ze-webpack-plugin';
import { ZephyrWebpackPluginOptions } from '../types';
import { WebpackConfiguration } from '../types/missing-webpack-types';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';

export function withZephyr(zephyrPluginOptions?: ZephyrWebpackPluginOptions) {
  return (config: Configuration) => _zephyr_configuration(config, zephyrPluginOptions);
}

async function _zephyr_configuration(
  config: WebpackConfiguration,
  _zephyrOptions?: ZephyrWebpackPluginOptions
): Promise<Configuration> {
  // create instance of ZephyrEngine to track the application
  ze_log('Creating ZephyrEngine instance...');
  const zephyr_engine = await ZephyrEngine.create(config.context);
  ze_log('ZephyrEngine instance created...');
  // Resolve dependencies and update the config
  const dependencyPairs = extractFederatedDependencyPairs(config);
  const resolved_dependency_pairs =
    await zephyr_engine.resolve_remote_dependencies(dependencyPairs);
  mutWebpackFederatedRemotesConfig(config, resolved_dependency_pairs);

  // inject the ZephyrWebpackPlugin
  config.plugins?.push(
    new ZeWebpackPlugin({
      zephyr_engine,
      mfConfig: makeCopyOfModuleFederationOptions(config),
      wait_for_index_html: _zephyrOptions?.wait_for_index_html,
    })
  );

  return config;
}
