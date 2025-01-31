import { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { AppTools, CliPlugin, CliPluginFuture } from '@modern-js/app-tools';
import { ZeRspackPlugin } from './ze-rspack-plugin';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import { ZephyrEngine } from 'zephyr-agent';

const pluginName = 'zephyr-modernjs-plugin';

const isDev = process.env['NODE_ENV'] === 'development';

export const withZephyr = (
  zephyrOptions?: ZephyrPluginOptions
): CliPluginFuture<AppTools<'rspack' | 'webpack'>> => ({
  name: pluginName,
  pre: ['@modern-js/plugin-module-federation-config'],

  setup: async (api) => {
    api.modifyConfig(async (config) => {
      const appContext = api.getAppContext();
      const zephyrEngineOptions = {
        context: appContext.appDirectory,
        builder: appContext.bundlerType === 'rspack' ? 'rspack' : 'webpack',
      } as const;

      const bundlerConfig = {
        context: appContext.appDirectory,
        // @ts-expect-error test
        plugins: config.tools?.[appContext.bundlerType!]?.plugins || [],
      };

      const zephyrEngine = await ZephyrEngine.create(zephyrEngineOptions);
      const dependencyPairs = extractFederatedDependencyPairs(bundlerConfig);
      console.log('dependencyPairs', dependencyPairs);
      const resolvedDependencies =
        await zephyrEngine.resolve_remote_dependencies(dependencyPairs);
      console.log('Resolved', resolvedDependencies);

      // Pass the bundler config instead of appContext
      mutWebpackFederatedRemotesConfig(zephyrEngine, bundlerConfig, resolvedDependencies);

      // Make copy of MF options from the bundler config
      const mfConfig = makeCopyOfModuleFederationOptions(bundlerConfig);

      return {
        tools: {
          webpack(config) {
            if (!config.plugins) {
              config.plugins = [];
            }
            config.plugins.push(
              // @ts-expect-error test
              new ZeRspackPlugin({
                zephyr_engine: zephyrEngine,
                mfConfig,
                wait_for_index_html: zephyrOptions?.wait_for_index_html,
              })
            );
            return config;
          },
          rspack(config) {
            if (!config.plugins) {
              config.plugins = [];
            }
            config.plugins.push(
              new ZeRspackPlugin({
                zephyr_engine: zephyrEngine,
                mfConfig,
                wait_for_index_html: zephyrOptions?.wait_for_index_html,
              })
            );
            return config;
          },
        },
      };
    });
  },
});

function zephyrFixPublicPath(): CliPlugin<AppTools> {
  return {
    name: 'zephyr-publicpath-fix',
    pre: [pluginName],
    setup: async () => ({
      config: async () => ({
        tools: {
          webpack(config, { isServer }) {
            if (!isServer) {
              config.output = { ...config.output, publicPath: 'auto' };
            }
            return config;
          },
          rspack(config, { isServer }) {
            if (!isServer) {
              config.output = { ...config.output, publicPath: 'auto' };
            }
            return config;
          },
        },
      }),
    }),
  };
}
