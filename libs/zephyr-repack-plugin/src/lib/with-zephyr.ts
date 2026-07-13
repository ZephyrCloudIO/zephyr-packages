import type { Configuration } from '@rspack/core';
import { handleGlobalError, ZephyrEngine, ze_log } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  extractLibraryType,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import type { RepackEnv } from '../type/zephyr-internal-types';
import { assertRepackNativeBuildTarget } from './native-target';
import { verify_mf_fastly_config } from './utils/ze-util-verification';
import { ZeRepackPlugin, type ZephyrRepackOptions } from './ze-repack-plugin';

export function withZephyr(zephyrPluginOptions?: ZephyrRepackOptions): (
  // First return: A function taking a config function
  configFn: (env: RepackEnv) => Configuration
) => (
  // Second return: A function taking a config object
  config: RepackEnv
) => Promise<Configuration> {
  if (zephyrPluginOptions?.target !== undefined) {
    assertRepackNativeBuildTarget(zephyrPluginOptions.target, 'withZephyr({ target })');
  }

  // RETURN 1: Function that takes the user's config function
  return (configFn: (env: RepackEnv) => Configuration) => {
    // RETURN 2: Function that takes the base config and returns the final webpack config
    return async (config: RepackEnv) => {
      // Extract environment from config
      const platform = config.platform;
      assertRepackNativeBuildTarget(platform, 'Re.Pack config platform');

      // Re-check at invocation time in case an untyped caller mutates the
      // options object after the wrapper is created.
      const target = zephyrPluginOptions?.target ?? platform;
      assertRepackNativeBuildTarget(target, 'withZephyr({ target })');

      // Generate user config by calling their function with env
      const userConfig = configFn({
        platform,
        mode: config.mode,
      });

      const updatedZephyrConfig = {
        ...zephyrPluginOptions,
        target,
      } satisfies ZephyrRepackOptions;

      ze_log.init('updatedZephyrConfig: ', updatedZephyrConfig);

      // Return the final processed configuration
      return _zephyr_configuration(userConfig, updatedZephyrConfig);
    };
  };
}
async function _zephyr_configuration(
  config: Configuration,

  _zephyrOptions?: ZephyrRepackOptions
): Promise<Configuration> {
  const target = _zephyrOptions?.target;
  // Keep unsupported targets out of the error handler below. The handler is
  // intentionally best-effort for ordinary configuration errors, while an
  // unsupported target must fail closed before an engine can be created.
  assertRepackNativeBuildTarget(target, 'Re.Pack target');

  let zephyr_engine: ZephyrEngine | undefined;
  try {
    // create instance of ZephyrEngine to track the application
    zephyr_engine = await ZephyrEngine.create({
      builder: 'repack',
      context: config.context,
    });
    ze_log.init('Configuring with Zephyr... \n config: ', config);

    zephyr_engine.env.target = target;

    const dependency_pairs = extractFederatedDependencyPairs(config);

    ze_log.init(
      'Resolving and building towards target by zephyr_engine.env.target: ',
      zephyr_engine.env.target
    );

    const resolved_dependency_pairs = await zephyr_engine.resolve_remote_dependencies(
      dependency_pairs,
      extractLibraryType(config.output?.library)
    );
    mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

    ze_log.remotes(
      'dependency resolution completed successfully...or at least trying to...'
    );

    const mf_configs = makeCopyOfModuleFederationOptions(config);
    // Verify Module Federation configuration's naming
    await verify_mf_fastly_config(mf_configs, zephyr_engine);

    ze_log.app('Application uid created...');
    config.plugins?.push(
      new ZeRepackPlugin({
        zephyr_engine,
        mfConfig: makeCopyOfModuleFederationOptions(config),
        target,
        hooks: _zephyrOptions?.hooks,
      })
    );
  } catch (error) {
    if (zephyr_engine?.hasActiveBuild !== false) {
      zephyr_engine?.build_failed();
    }
    handleGlobalError(error);
  }

  return config;
}
