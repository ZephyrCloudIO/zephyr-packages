import { Configuration } from '@rspack/core';
import { ze_log, ZeErrors, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import { ZephyrRepackPluginOptions, ZeRepackPlugin } from './ze-repack-plugin';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';

import { verify_mf_fastly_config } from './utils/ze-util-verification';
import { RepackEnv } from '../type/zephyr-internal-types';

// withZephyr's anonymous function could be a function or a static configuration

type ConfigFactory = Configuration | ((env: RepackEnv) => Configuration);

type PromiseConfigFactory =
  | Promise<Configuration>
  | ((env: RepackEnv) => Promise<Configuration>);

type WithZephyrReturn = (config: ConfigFactory) => PromiseConfigFactory;

function fromFunction(
  configFn: (env: RepackEnv) => Configuration,
  zephyrPluginOptions?: ZephyrRepackPluginOptions
): (config: RepackEnv) => Promise<Configuration> {
  return (_config: RepackEnv) => {
    const userConfig = configFn({
      platform: _config.platform,
      mode: _config.mode,
    });

    const updatedZephyrConfig = {
      ...zephyrPluginOptions,
      target: _config.platform,
    } as ZephyrRepackPluginOptions;

    ze_log('from_function.updatedZephyrConfig: ', updatedZephyrConfig);
    return _zephyr_configuration(
      userConfig,
      updatedZephyrConfig
    ) as Promise<Configuration>;
  };
}

function fromObject(
  config: Configuration,
  zephyrPluginOptions?: ZephyrRepackPluginOptions
): Promise<Configuration> {
  ze_log('from_object.config: ', config);
  const updatedZephyrConfig = {
    ...zephyrPluginOptions,
    target: config.plugins,
  } as ZephyrRepackPluginOptions;

  ze_log('from_object.updatedZephyrConfig: ', updatedZephyrConfig);
  return _zephyr_configuration(config, updatedZephyrConfig);
}

export function withZephyr(
  zephyrPluginOptions?: ZephyrRepackPluginOptions
): WithZephyrReturn {
  return function (config: ConfigFactory): PromiseConfigFactory {
    return typeof config === 'function'
      ? fromFunction(config, zephyrPluginOptions)
      : fromObject(config, zephyrPluginOptions);
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
