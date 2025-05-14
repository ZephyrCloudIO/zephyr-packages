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
import { insertRuntimeEnvPlugin } from './env/insert-runtime-env-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { generateRuntimeEnvPlugin } from './env/generate-runtime-env.plugin';

export function withZephyr(zephyrPluginOptions?: ZephyrWebpackPluginOptions) {
  return (config: Configuration) => {
    
    return _zephyr_configuration(config, zephyrPluginOptions);
  }
}

async function _zephyr_configuration(
  config: WebpackConfiguration,
  _zephyrOptions?: ZephyrWebpackPluginOptions
): Promise<Configuration> {
  try {
    const zephyr_engine = await ZephyrEngine.create({
      builder: 'webpack',
      context: config.context,
    });

    const dependencyPairs = extractFederatedDependencyPairs(config);
    const resolved_dependency_pairs =
      await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

    mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

    const mfConfig = makeCopyOfModuleFederationOptions(config);

    ze_log(`with-zephyr.mfConfig: ${JSON.stringify(mfConfig, null, 2)}`);

    config.plugins = filterPlugins(config);

    config.plugins?.push(...zephyrEnvsPlugin());
  
    
    // config.plugins?.push(
    //   new ZeWebpackPlugin({
    //     zephyr_engine,
    //     mfConfig: mfConfig,
    //     wait_for_index_html: _zephyrOptions?.wait_for_index_html,
    //   })
    // );
  } catch (error) {
    logFn('error', ZephyrError.format(error));
  }

  return config;
}

function filterPlugins(config: Configuration) {
  return (config.plugins || []).filter(
    (plugin) => plugin?.constructor?.name !== 'WriteIndexHtmlPlugin'
  )
}

function zephyrEnvsPlugin() {
  return [
    new HtmlWebpackPlugin({ template: './src/index.html' }),
    insertRuntimeEnvPlugin(),
    generateRuntimeEnvPlugin()
  ]
}