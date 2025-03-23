import { Configuration } from '@rspack/core';
import { ze_log, ZephyrEngine } from 'zephyr-agent';
import { ZephyrRepackPluginOptions, ZeRepackPlugin } from './ze-repack-plugin';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';

import { verify_mf_fastly_config } from './utils/ze-util-verification';
import { RepackEnv } from '../type/zephyr-internal-types';

export function withZephyr(zephyrPluginOptions?: ZephyrRepackPluginOptions): (
  // First return: A function taking a config function
  configFn: (env: RepackEnv) => Configuration
) => (
  // Second return: A function taking a config object
  config: RepackEnv
) => Promise<Configuration> {
  // RETURN 1: Function that takes the user's config function
  return (configFn: (env: RepackEnv) => Configuration) => {
    // RETURN 2: Function that takes the base config and returns the final webpack config
    return (config: RepackEnv) => {
      // Extract environment from config

      // Generate user config by calling their function with env
      const userConfig = configFn({
        platform: config.platform,
        mode: config.mode,
      });

      const updatedZephyrConfig = {
        ...zephyrPluginOptions,
        target: config.platform,
      } as ZephyrRepackPluginOptions;

      ze_log('updatedZephyrConfig: ', updatedZephyrConfig);

      // Return the final processed configuration
      return _zephyr_configuration(userConfig, updatedZephyrConfig);
    };
  };
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
  ze_log(
    'Configuring with Zephyr... \n config:',
    config,
    '\n _zephyrOptions: ',
    _zephyrOptions
  );

  zephyr_engine.env.target = _zephyrOptions?.target;

  const dependency_pairs = extractFederatedDependencyPairs(config);

  ze_log(
    'Resolving and building towards target by zephyr_engine.env.target: ',
    zephyr_engine.env.target
  );

  const resolved_dependency_pairs = await zephyr_engine.resolve_remote_dependencies(
    dependency_pairs,
    zephyr_engine.env.target
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
      mfConfig: makeCopyOfModuleFederationOptions(config),
    })
  );

  return config;
}
