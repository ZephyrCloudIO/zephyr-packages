import { Configuration, rspack } from '@rspack/core';
import { ze_log, ZeErrors, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import { ZephyrRepackPluginOptions, ZeRepackPlugin } from './ze-repack-plugin';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';

import { verify_mf_fastly_config } from './utils/ze-util-verification';
import { getNativeVersionInfoAsync } from './utils/ze-util-native-versions';
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
  ze_log('Configuring with Zephyr... \n config: ', config);

  if (!_zephyrOptions?.target) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_PLATFORM);
  }
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

  // Get native version information if we're building for a mobile platform
  let nativeVersionInfo = { version: '0.0.0', buildNumber: '0' };

  try {
    nativeVersionInfo = await getNativeVersionInfoAsync(
      _zephyrOptions.target,
      config.context || process.cwd()
    );
    ze_log(`Native ${_zephyrOptions.target} version info:`, nativeVersionInfo);
  } catch (error) {
    ze_log(`Error getting native version info for ${_zephyrOptions.target}:`, error);
  }

  zephyr_engine.env.native_version = nativeVersionInfo.version;
  zephyr_engine.env.native_build_number = nativeVersionInfo.buildNumber;

  const defineConfig = {
    ZE_BUILD_ID: JSON.stringify(await zephyr_engine.build_id),
    ZE_SNAPSHOT_ID: JSON.stringify(await zephyr_engine.snapshotId),
    ZE_APP_ID: JSON.stringify(zephyr_engine.application_uid),
    ZE_MF_CONFIG: JSON.stringify(mf_configs),
    ZE_UPDATED_AT: JSON.stringify(
      (await zephyr_engine.application_configuration).fetched_at
    ),
    ZE_EDGE_URL: JSON.stringify((await zephyr_engine.application_configuration).EDGE_URL),
    ZE_NATIVE_VERSION: JSON.stringify(nativeVersionInfo.version),
    ZE_NATIVE_BUILD_NUMBER: JSON.stringify(nativeVersionInfo.buildNumber),
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

  return config;
}
