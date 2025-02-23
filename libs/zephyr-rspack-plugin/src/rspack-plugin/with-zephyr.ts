import { Configuration as RspackConfiguration } from '@rspack/core';
import { ZephyrEngine } from 'zephyr-agent';
import { ZeRspackPlugin } from './ze-rspack-plugin';
import { ZephyrRspackPluginOptions } from '../types';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';

export type Configuration = RspackConfiguration;

export function withZephyr(
  zephyrPluginOptions?: ZephyrRspackPluginOptions
): (config: Configuration) => Promise<Configuration> {
  return (config) => _zephyr_configuration(config, zephyrPluginOptions);
}

async function _zephyr_configuration(
  config: Configuration,
  _zephyrOptions?: ZephyrRspackPluginOptions
): Promise<Configuration> {
  // create instance of ZephyrEngine to track the application
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'rspack',
    context: config.context,
  });

  // Resolve dependencies and update the config
  const dependencyPairs = extractFederatedDependencyPairs(config);

  const resolved_dependency_pairs =
    await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

  mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

  // inject the ZephyrRspackPlugin
  config.plugins?.push(
    new ZeRspackPlugin({
      zephyr_engine,
      mfConfig: makeCopyOfModuleFederationOptions(config),
      wait_for_index_html: _zephyrOptions?.wait_for_index_html,
    })
  );

  return config;
}
