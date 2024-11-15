import { Configuration } from 'webpack';
import { ZephyrEngine } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
  WebpackConfiguration,
} from '../webpack-extract';
import { ZeWebpackPlugin } from './ze-webpack-plugin';
import { ZephyrWebpackPluginOptions } from '../types';

export function withZephyr(zephyrPluginOptions?: ZephyrWebpackPluginOptions) {
  return (config: Configuration) => _zephyr_configuration(config, zephyrPluginOptions);
}

async function _zephyr_configuration(
  config: WebpackConfiguration,
  _zephyrOptions?: ZephyrWebpackPluginOptions
): Promise<Configuration> {
  // create instance of ZephyrEngine to track the application
  const zephyr_engine = await ZephyrEngine.create(config.context);

  // Resolve dependencies and update the config
  const dependencyPairs = extractFederatedDependencyPairs(config);
  const resolved_dependency_pairs =
    await zephyr_engine.resolve_remote_dependencies(dependencyPairs);
  mutWebpackFederatedRemotesConfig(config, resolved_dependency_pairs);

  // inject the ZephyrWebpackPlugin
  config.plugins?.push(
    new ZeWebpackPlugin({
      zephyr_engine,
      mfConfig: makeCopyOfModuleFederationOptions(config),
      wait_for_index_html: _zephyrOptions?.wait_for_index_html,
    })
  );

  return config;
}
