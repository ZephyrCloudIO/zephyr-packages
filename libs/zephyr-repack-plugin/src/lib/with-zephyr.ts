import type { Configuration } from '@rspack/core';
import { rspack } from '@rspack/core';
import { ZeErrors, ZephyrEngine, ZephyrError, logFn, ze_log } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import type { RepackEnv } from '../type/zephyr-internal-types';
import {
  getDependencyHashes,
  getNativeVersionInfoAsync,
} from './native-versions/ze-util-native-versions';
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
  try {
    if (!_zephyrOptions?.target) {
      throw new ZephyrError(ZeErrors.ERR_MISSING_PLATFORM);
    }
    const nativeVersionInfo = await getNativeVersionInfoAsync(
      _zephyrOptions.target,
      config.context || process.cwd()
    );

    // create instance of ZephyrEngine to track the application
    const zephyr_engine = await ZephyrEngine.create({
      builder: 'repack',
      context: config.context,
    });
    ze_log('Configuring with Zephyr... \n config: ', config);

    zephyr_engine.env.target = _zephyrOptions?.target;

    const dependency_pairs = extractFederatedDependencyPairs(config);

    ze_log(
      'Resolving and building towards target by zephyr_engine.env.target: ',
      zephyr_engine.env.target
    );

    const resolved_dependency_pairs =
      await zephyr_engine.resolve_remote_dependencies(dependency_pairs);
    mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

    ze_log('dependency resolution completed successfully...or at least trying to...');

    const mf_configs = makeCopyOfModuleFederationOptions(config);
    // const app_config = await zephyr_engine.application_configuration;
    // Verify Module Federation configuration's naming
    await verify_mf_fastly_config(mf_configs, zephyr_engine);

    // Extend

    ze_log(`Native ${_zephyrOptions.target} version info:`, nativeVersionInfo);

    zephyr_engine.npmProperties.version = nativeVersionInfo.native_version;

    zephyr_engine.env.native_config_file_hash = (
      await getDependencyHashes(config.context || process.cwd(), _zephyrOptions.target)
    ).nativeConfigHash;

    ze_log('Native config file hash: ', zephyr_engine.env.native_config_file_hash);
    const defineConfig = {
      ZE_BUILD_ID: await zephyr_engine.build_id,
      ZE_SNAPSHOT_ID: await zephyr_engine.snapshotId,
      ZE_APP_ID: zephyr_engine.application_uid,
      ZE_MF_CONFIG: JSON.stringify(mf_configs),
      ZE_UPDATED_AT: JSON.stringify(
        (await zephyr_engine.application_configuration).fetched_at
      ),
      ZE_EDGE_URL: (await zephyr_engine.application_configuration).EDGE_URL,
      ZE_NATIVE_VERSION: nativeVersionInfo.native_version,
      ZE_NATIVE_BUILD_NUMBER: nativeVersionInfo.native_build_number,
    };

    ze_log('Content in defineConfig: ', defineConfig);

    ze_log('Application uid created...');
    config.plugins?.push(
      new ZeRepackPlugin({
        zephyr_engine,
        mfConfig: makeCopyOfModuleFederationOptions(config),
        target: zephyr_engine.env.target,
      }),
      new rspack.DefinePlugin(defineConfig)
    );
  } catch (error) {
    logFn('error', ZephyrError.format(error));
  }

  return config;
}
