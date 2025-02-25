import { Configuration } from '@rspack/core';
import { ze_log, ZephyrEngine } from 'zephyr-agent';

import { ZephyrRepackPluginOptions } from './types';
import { ZeRepackPlugin } from './ze-base-repack-plugin';
import { get_platform_from_repack } from './utils/get-platform';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import { repack_delegate_module_template } from '../delegate-module/delegate-module-template';
import { verify_mf_fastly_config } from './utils/ze-util-verification';

/**
 * Creates a function that enhances a Repack configuration with Zephyr capabilities
 *
 * @param userOptions - Optional Zephyr plugin options
 * @returns A function that takes a Repack configuration and returns an enhanced
 *   configuration
 */
export function withZephyr(
  userOptions?: ZephyrRepackPluginOptions
): (config: Configuration) => Promise<Configuration> {
  return (config: Configuration) => _zephyr_configuration(config, userOptions);
}

/**
 * Internal function to enhance a Repack configuration with Zephyr capabilities
 *
 * @param config - The original Repack configuration
 * @param userOptions - Optional user-provided options
 * @returns A Promise with the enhanced configuration
 */
async function _zephyr_configuration(
  config: Configuration,
  userOptions?: ZephyrRepackPluginOptions
): Promise<Configuration> {
  // Create instance of ZephyrEngine to track the application
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'repack',
    context: config.context,
  });
  ze_log('Configuring with Zephyr...');

  // Detect the target platform from the Repack configuration
  const target = get_platform_from_repack(config);
  ze_log('Deploy build target: ', target);

  // Extract and resolve dependency pairs
  const dependency_pairs = extractFederatedDependencyPairs(config);
  const resolved_dependency_pairs = await zephyr_engine.resolve_remote_dependencies(
    dependency_pairs,
    target
  );

  // Mutate the configuration with resolved dependencies
  mutWebpackFederatedRemotesConfig(
    zephyr_engine,
    config,
    resolved_dependency_pairs,
    repack_delegate_module_template
  );

  ze_log('Dependency resolution completed successfully');

  // Get Module Federation configurations and verify them
  const mf_configs = makeCopyOfModuleFederationOptions(config);
  await verify_mf_fastly_config(mf_configs, zephyr_engine);

  ze_log('Application uid created...');

  // Create plugin options combining user options with detected values
  const pluginOptions = {
    zephyr_engine,
    target: userOptions?.target || target,
    wait_for_index_html: userOptions?.wait_for_index_html,
    mfConfig: makeCopyOfModuleFederationOptions(config),
  };

  // Add the Zephyr plugin to the configuration
  config.plugins?.push(new ZeRepackPlugin(pluginOptions));

  return config;
}
