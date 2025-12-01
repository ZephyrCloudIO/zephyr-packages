import type { Configuration } from '@rspack/core';
import { ZeErrors, ZephyrEngine, ZephyrError, logFn, ze_log } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import type { RepackEnv } from '../type/zephyr-internal-types';
import { verify_mf_fastly_config } from './utils/ze-util-verification';
import { ZeRepackPlugin, type ZephyrRepackPluginOptions } from './ze-repack-plugin';

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

      ze_log.init('Zephyr config (with OTA support if enabled): ', updatedZephyrConfig);

      // Return the final processed configuration with OTA enhancements if enabled
      return _zephyr_configuration(userConfig, updatedZephyrConfig);
    };
  };
}
async function _zephyr_configuration(
  config: Configuration,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _zephyrOptions?: ZephyrRepackPluginOptions
): Promise<Configuration> {
  try {
    // create instance of ZephyrEngine to track the application
    const zephyr_engine = await ZephyrEngine.create({
      builder: 'repack',
      context: config.context,
    });
    ze_log.init('Configuring with Zephyr... \n config: ', config);

    if (!_zephyrOptions?.target) {
      throw new ZephyrError(ZeErrors.ERR_MISSING_PLATFORM);
    }
    zephyr_engine.env.target = _zephyrOptions?.target;

    const dependency_pairs = extractFederatedDependencyPairs(config);

    ze_log.init(
      'Resolving and building towards target by zephyr_engine.env.target: ',
      zephyr_engine.env.target
    );

    const resolved_dependency_pairs =
      await zephyr_engine.resolve_remote_dependencies(dependency_pairs);

    // Apply remote config mutation
    mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

    ze_log.remotes(
      'dependency resolution completed successfully...or at least trying to...'
    );

    // Log OTA configuration if enabled
    if (_zephyrOptions?.enableOTA) {
      ze_log.app('OTA support enabled - see documentation for runtime setup');
      ze_log.app('App UID:', _zephyrOptions.applicationUid || 'not specified');
    }

    const mf_configs = makeCopyOfModuleFederationOptions(config);
    // const app_config = await zephyr_engine.application_configuration;
    // Verify Module Federation configuration's naming
    await verify_mf_fastly_config(mf_configs, zephyr_engine);

    ze_log.app('Application uid created...');
    config.plugins?.push(
      new ZeRepackPlugin({
        zephyr_engine,
        mfConfig: makeCopyOfModuleFederationOptions(config),
        target: zephyr_engine.env.target,
        enableOTA: _zephyrOptions?.enableOTA,
        applicationUid: _zephyrOptions?.applicationUid,
        otaConfig: _zephyrOptions?.otaConfig,
        hooks: _zephyrOptions?.hooks,
      })
    );
  } catch (error) {
    logFn('error', ZephyrError.format(error));
  }

  return config;
}
