import type { Configuration } from '@rspack/core';
import { rspack } from '@rspack/core';
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

      ze_log.init('updatedZephyrConfig: ', updatedZephyrConfig);

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
  try {
    if (!_zephyrOptions?.target) {
      throw new ZephyrError(ZeErrors.ERR_MISSING_PLATFORM);
    }
    // create instance of ZephyrEngine to track the application
    const zephyr_engine = await ZephyrEngine.create({
      builder: 'repack',
      context: config.context,
    });
    ze_log.init('Configuring with Zephyr... \n config: ', config);

    zephyr_engine.env.target = _zephyrOptions?.target;

    const dependency_pairs = extractFederatedDependencyPairs(config);

    ze_log.init(
      'Resolving and building towards target by zephyr_engine.env.target: ',
      zephyr_engine.env.target
    );

    const resolved_dependency_pairs =
      await zephyr_engine.resolve_remote_dependencies(dependency_pairs);
    mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

    ze_log.remotes(
      'dependency resolution completed successfully...or at least trying to...'
    );

    const mf_configs = makeCopyOfModuleFederationOptions(config);
    // const app_config = await zephyr_engine.application_configuration;
    // Verify Module Federation configuration's naming
    await verify_mf_fastly_config(mf_configs, zephyr_engine);

    ze_log.app('Native config file hash: ', zephyr_engine.env.lock_file_hash);
    const define_config = {
      ZE_BUILD_ID: JSON.stringify(await zephyr_engine.build_id),
      ZE_SNAPSHOT_ID: JSON.stringify(await zephyr_engine.snapshotId),
      ZE_APP_UID: JSON.stringify(zephyr_engine.application_uid),
      /** Provided as final resolved module for Module Federation */
      ZE_MF_CONFIG: JSON.stringify(mf_configs),
      /** Provided as comparison for app_uid and selectors */
      ZE_DEPENDENCIES: JSON.stringify(
        await zephyr_engine.npmProperties.zephyrDependencies
      ),
      ZE_UPDATED_AT: JSON.stringify(
        (await zephyr_engine.application_configuration).fetched_at
      ),
      ZE_EDGE_URL: JSON.stringify(
        (await zephyr_engine.application_configuration).EDGE_URL
      ),
      /** Native version of the application */
      ZE_NATIVE_VERSION: JSON.stringify(zephyr_engine.applicationProperties.version),
      ZE_BUILD_CONTEXT: JSON.stringify(config.context),
      ZE_FINGERPRINT: JSON.stringify(zephyr_engine.env.lock_file_hash),
      ZE_IS_CI: JSON.stringify(zephyr_engine.env.isCI),
      ZE_USER: JSON.stringify((await zephyr_engine.application_configuration).username),
      ZE_BRANCH: JSON.stringify(zephyr_engine.gitProperties.git.branch),
    };

    ze_log.app('Content in defineConfig: ', define_config);

    // Extend

    ze_log.app('Application uid created...');
    config.plugins?.push(
      new ZeRepackPlugin({
        zephyr_engine,
        mfConfig: makeCopyOfModuleFederationOptions(config),
        target: zephyr_engine.env.target,
      }),
      new rspack.DefinePlugin(define_config)
    );
  } catch (error) {
    logFn('error', ZephyrError.format(error));
  }

  return config;
}
