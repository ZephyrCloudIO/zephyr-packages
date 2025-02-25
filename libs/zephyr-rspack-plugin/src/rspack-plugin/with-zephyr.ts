import { Configuration as CoreRspackConfiguration } from '@rspack/core';
import { ZephyrEngine } from 'zephyr-agent';
import { ZeRspackPlugin, ZephyrRspackInternalPluginOptions } from './ze-rspack-plugin';
import { ZephyrRspackPluginOptions } from '../types';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';

export type Configuration = CoreRspackConfiguration;

/**
 * Factory function to add Zephyr capabilities to an Rspack configuration
 *
 * @param zephyrPluginOptions - Optional Zephyr plugin options
 * @returns A function that takes an Rspack configuration and returns a Promise with an
 *   enhanced configuration
 */
export function withZephyr(
  zephyrPluginOptions?: ZephyrRspackPluginOptions
): (config: Configuration) => Promise<Configuration> {
  return (config) => _zephyr_configuration(config, zephyrPluginOptions);
}

/**
 * Internal function to enhance an Rspack configuration with Zephyr capabilities
 *
 * @param config - The original Rspack configuration
 * @param zephyrOptions - Optional Zephyr plugin options
 * @returns A Promise with the enhanced configuration
 */
async function _zephyr_configuration(
  config: Configuration,
  zephyrOptions?: ZephyrRspackPluginOptions
): Promise<Configuration> {
  // Create instance of ZephyrEngine to track the application
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'rspack',
    context: config.context,
  });

  // Resolve dependencies and update the config
  const dependencyPairs = extractFederatedDependencyPairs(config);

  const resolved_dependency_pairs =
    await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

  mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

  // Create plugin options for ZeRspackPlugin
  const pluginOptions: Omit<ZephyrRspackInternalPluginOptions, 'pluginName'> = {
    zephyr_engine,
    mfConfig: makeCopyOfModuleFederationOptions(config),
    wait_for_index_html: zephyrOptions?.wait_for_index_html,
  };

  // Inject the ZephyrRspackPlugin
  config.plugins?.push(new ZeRspackPlugin(pluginOptions));

  return config;
}
