import { ze_log, ZephyrEngine } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';

import { ZeWebpackPlugin } from './ze-webpack-plugin';
import { WebpackConfiguration, ZephyrWebpackPluginOptions } from '../types';

/**
 * Enhance webpack configuration with Zephyr integration
 *
 * @param zephyrPluginOptions - Options for the Zephyr webpack plugin
 * @returns A function that takes a webpack configuration and returns an enhanced one
 */
export function withZephyr(zephyrPluginOptions?: ZephyrWebpackPluginOptions) {
  return (config: WebpackConfiguration) =>
    _zephyr_configuration(config, zephyrPluginOptions);
}

/**
 * Internal function that enhances webpack configuration with Zephyr
 *
 * @param config - Webpack configuration object
 * @param _zephyrOptions - Options for the Zephyr webpack plugin
 * @returns Enhanced webpack configuration with Zephyr plugin
 */
async function _zephyr_configuration(
  config: WebpackConfiguration,
  _zephyrOptions?: ZephyrWebpackPluginOptions
): Promise<WebpackConfiguration> {
  // Create instance of ZephyrEngine to track the application
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'webpack',
    context: config.context,
  });

  // Resolve dependencies and update the config
  const dependencyPairs = extractFederatedDependencyPairs(config);
  const resolved_dependency_pairs =
    await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

  mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

  const mfConfig = makeCopyOfModuleFederationOptions(config);

  ze_log(`with-zephyr.mfConfig: ${JSON.stringify(mfConfig, null, 2)}`);

  // Create and inject the ZephyrWebpackPlugin
  const plugin = new ZeWebpackPlugin({
    zephyr_engine,
    mfConfig: mfConfig,
    wait_for_index_html: _zephyrOptions?.wait_for_index_html,
  });

  config.plugins?.push(plugin);

  return config;
}
