/**
 * Provides a configuration function to integrate Zephyr with webpack
 *
 * @file Factory function for setting up Zephyr with webpack
 */

import { ze_log, ZephyrEngine } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';

import { ZeWebpackPlugin } from './ze-webpack-plugin';
import { WebpackConfiguration, ZephyrWebpackPluginOptions } from '../types';

/**
 * Enhances webpack configuration with Zephyr integration
 *
 * This is the main factory function that users interact with. It returns a function that
 * takes a webpack configuration and enhances it with Zephyr integration.
 *
 * @param {ZephyrWebpackPluginOptions} [zephyrPluginOptions] - Options for the Zephyr
 *   webpack plugin
 * @returns {(config: WebpackConfiguration) => Promise<WebpackConfiguration>} A function
 *   that enhances webpack configuration
 */
export function withZephyr(zephyrPluginOptions?: ZephyrWebpackPluginOptions) {
  return (config: WebpackConfiguration) =>
    _zephyr_configuration(config, zephyrPluginOptions);
}

/**
 * Internal function that enhances webpack configuration with Zephyr
 *
 * This function:
 *
 * 1. Creates a ZephyrEngine instance
 * 2. Extracts and resolves module federation dependencies
 * 3. Updates the webpack configuration with resolved remotes
 * 4. Creates and injects the ZephyrWebpackPlugin
 *
 * @async
 * @private
 * @param {WebpackConfiguration} config - Webpack configuration object
 * @param {ZephyrWebpackPluginOptions} [_zephyrOptions] - Options for the Zephyr webpack
 *   plugin
 * @returns {Promise<WebpackConfiguration>} Enhanced webpack configuration with Zephyr
 *   plugin
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
