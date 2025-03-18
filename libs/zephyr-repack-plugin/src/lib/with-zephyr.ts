import { Configuration } from '@rspack/core';
import { ze_log, ZephyrEngine } from 'zephyr-agent';

import { ZephyrRepackPluginOptions, ZeRepackPlugin } from './ze-repack-plugin';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import { repack_delegate_module_template } from '../delegate-module/delegate-module-template';
import { verify_mf_fastly_config } from './utils/ze-util-verification';
import { DelegateConfig } from '../type/zephyr-internal-types';

type Platform = DelegateConfig['target'];
export interface RePackConfiguration extends Configuration {
  platform: Platform;
}

export function withZephyr(
  zephyrPluginOptions?: ZephyrRepackPluginOptions
): (config: RePackConfiguration) => Promise<Configuration> {
  return (config: RePackConfiguration) =>
    _zephyr_configuration(config, zephyrPluginOptions);
}
async function _zephyr_configuration(
  config: RePackConfiguration,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _zephyrOptions?: ZephyrRepackPluginOptions
): Promise<Configuration> {
  // create instance of ZephyrEngine to track the application
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'repack',
    context: config.context,
  });
  ze_log('Configuring with Zephyr...');

  if (!_zephyrOptions?.target) {
    throw new ZephyrError(ZeErrors.ERR_TARGET_NOT_SPECIFIED);
  }

  const dependency_pairs = extractFederatedDependencyPairs(config);

  zephyr_engine.env.target = _zephyrOptions.target;

  ze_log('Resolving and building towards target: ', zephyr_engine.env.target);

  const resolved_dependency_pairs = await zephyr_engine.resolve_remote_dependencies(
    dependency_pairs,
    zephyr_engine.env.target
  );
  mutWebpackFederatedRemotesConfig(
    zephyr_engine,
    config,
    resolved_dependency_pairs,
    repack_delegate_module_template
  );

  ze_log('dependency resolution completed successfully...or at least trying to...');

  const mf_configs = makeCopyOfModuleFederationOptions(config);
  // const app_config = await zephyr_engine.application_configuration;
  // Verify Module Federation configuration's naming
  await verify_mf_fastly_config(mf_configs, zephyr_engine);

  ze_log('Application uid created...');
  config.plugins?.push(
    new ZeRepackPlugin({
      zephyr_engine,
      mfConfig: makeCopyOfModuleFederationOptions(config),
      target: zephyr_engine.env.target,
    })
  );

  return config;
}
