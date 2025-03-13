import { Configuration } from '@rspack/core';
import { ze_log, ZephyrEngine } from 'zephyr-agent';

import { ZephyrRepackPluginOptions, ZeRepackPlugin } from './ze-repack-plugin';
import { get_platform_from_repack } from './utils/get-platform';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import { verify_mf_fastly_config } from './utils/ze-util-verification';

export function withZephyr(
  zephyrPluginOptions?: ZephyrRepackPluginOptions
): (config: Configuration) => Promise<Configuration> {
  return (config: Configuration) => _zephyr_configuration(config, zephyrPluginOptions);
}
async function _zephyr_configuration(
  config: Configuration,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _zephyrOptions?: ZephyrRepackPluginOptions
): Promise<Configuration> {
  // create instance of ZephyrEngine to track the application
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'repack',
    context: config.context,
  });
  ze_log('Configuring with Zephyr...');

  const target = get_platform_from_repack(config);
  ze_log('Deploy build target: ', target);

  const dependency_pairs = extractFederatedDependencyPairs(config);

  const resolved_dependency_pairs = await zephyr_engine.resolve_remote_dependencies(
    dependency_pairs,
    target
  );

  mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

  ze_log('dependency resolution completed successfully...or at least trying to...');

  const mf_configs = makeCopyOfModuleFederationOptions(config);
  // const app_config = await zephyr_engine.application_configuration;
  // Verify Module Federation configuration's naming
  await verify_mf_fastly_config(mf_configs, zephyr_engine);

  ze_log('Application uid created...');
  config.plugins?.push(
    new ZeRepackPlugin({
      zephyr_engine,
      target,
      mfConfig: makeCopyOfModuleFederationOptions(config),
    })
  );

  return config;
}
