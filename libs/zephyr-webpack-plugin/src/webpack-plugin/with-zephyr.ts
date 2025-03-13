import { Configuration } from 'webpack';
import { ze_log, ZephyrEngine } from 'zephyr-agent';

import { ZeWebpackPlugin } from './ze-webpack-plugin';
import { ZephyrWebpackPluginOptions } from '../types';
import { WebpackConfiguration } from '../types/missing-webpack-types';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
  xpack_delegate_module_template,
} from 'zephyr-xpack-internal';

export function withZephyr(zephyrPluginOptions?: ZephyrWebpackPluginOptions) {
  return (config: Configuration) => _zephyr_configuration(config, zephyrPluginOptions);
}

async function _zephyr_configuration(
  config: WebpackConfiguration,
  _zephyrOptions?: ZephyrWebpackPluginOptions
): Promise<Configuration> {
  // create instance of ZephyrEngine to track the application
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'webpack',
    context: config.context,
  });

  // Resolve dependencies and update the config
  const dependencyPairs = extractFederatedDependencyPairs(config);
  const resolved_dependency_pairs =
    await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

  mutWebpackFederatedRemotesConfig(
    zephyr_engine,
    config,
    resolved_dependency_pairs,
    xpack_delegate_module_template
  );

  const mfConfig = makeCopyOfModuleFederationOptions(config);

  ze_log(`with-zephyr.mfConfig: ${JSON.stringify(mfConfig, null, 2)}`);

  // inject the ZephyrWebpackPlugin
  config.plugins?.push(
    new ZeWebpackPlugin({
      zephyr_engine,
      mfConfig: mfConfig,
      wait_for_index_html: _zephyrOptions?.wait_for_index_html,
    })
  );

  return config;
}
