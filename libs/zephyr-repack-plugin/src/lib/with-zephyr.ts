import { Configuration } from '@rspack/core';
import { ze_log, ZephyrEngine, verify_mf_fastly_config } from 'zephyr-agent';

import { ZephyrRepackPluginOptions, ZeRepackPlugin } from './ze-repack-plugin';
import { get_platform_from_repack } from './utils/get-platform';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import { repack_delegate_module_template } from '../delegate-module/delegate-module-template';

export function withZephyr(
  zephyrPluginOptions?: ZephyrRepackPluginOptions
): (config: Configuration) => Promise<Configuration> {
  return (config: Configuration) => _zephyr_configuration(config, zephyrPluginOptions);
}
async function _zephyr_configuration(
  config: Configuration,
  _zephyrOptions?: ZephyrRepackPluginOptions
): Promise<Configuration> {
  // create instance of ZephyrEngine to track the application
  const zephyr_engine = await ZephyrEngine.create(config.context);
  ze_log('Configuring with Zephyr...');

  zephyr_engine.build_type = 'repack';

  const target = get_platform_from_repack(config);
  ze_log('Deploy build target: ', target);

  const dependency_pairs = extractFederatedDependencyPairs(zephyr_engine, config);

  const resolved_depdency_pairs = await zephyr_engine.resolve_remote_dependencies(
    dependency_pairs,
    target
  );

  mutWebpackFederatedRemotesConfig(
    zephyr_engine,
    config,
    resolved_depdency_pairs,
    repack_delegate_module_template
  );

  ze_log('dependency resolution completed successfully...or at least trying to...');

  const mf_configs = makeCopyOfModuleFederationOptions(zephyr_engine, config);
  // const app_config = await zephyr_engine.application_configuration;
  // Verify Module Federation configuration's naming
  await verify_mf_fastly_config(mf_configs, zephyr_engine);

  ze_log('Application uid created...');
  config.plugins?.push(
    new ZeRepackPlugin({
      zephyr_engine,
      target,
      upload_file: _zephyrOptions?.upload_file ? _zephyrOptions.upload_file : true,
      mfConfig: makeCopyOfModuleFederationOptions(zephyr_engine, config),
    })
  );

  return config;
}
