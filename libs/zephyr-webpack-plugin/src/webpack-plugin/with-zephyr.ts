import type { Configuration } from 'webpack';
import { ZephyrEngine, ZephyrError, logFn, ze_log } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import type { ZephyrWebpackPluginOptions } from '../types';
import type { WebpackConfiguration } from '../types/missing-webpack-types';
import { ZeWebpackPlugin } from './ze-webpack-plugin';

export function withZephyr(zephyrPluginOptions?: ZephyrWebpackPluginOptions) {
  return (config: Configuration) => _zephyr_configuration(config, zephyrPluginOptions);
}

/** Configures webpack with Zephyr integration */
async function _zephyr_configuration(
  config: WebpackConfiguration,
  _zephyrOptions?: ZephyrWebpackPluginOptions
): Promise<Configuration> {
  try {
    // Create instance of ZephyrEngine to track the application
    const zephyr_engine = await ZephyrEngine.create({
      builder: 'webpack',
      context: config.context,
    });

    // Extract and resolve federated dependencies
    const dependencyPairs = extractFederatedDependencyPairs(config);
    const resolved_dependency_pairs =
      await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

    // Mutate webpack config with federated remotes
    mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

    const mfConfig = makeCopyOfModuleFederationOptions(config);

    ze_log.mf(`with-zephyr.mfConfig: ${JSON.stringify(mfConfig, null, 2)}`);

    // Inject the ZephyrWebpackPlugin into the webpack configuration
    config.plugins?.push(
      new ZeWebpackPlugin({
        zephyr_engine,
        mfConfig: mfConfig,
        wait_for_index_html: _zephyrOptions?.wait_for_index_html,
      })
    );
  } catch (error) {
    logFn('error', ZephyrError.format(error));
  }

  return config;
}
