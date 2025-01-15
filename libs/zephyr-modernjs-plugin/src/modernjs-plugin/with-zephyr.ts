import { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { AppTools, CliPlugin } from '@modern-js/app-tools';
import { ZeRspackPlugin } from './ze-rspack-plugin';
import { ZephyrEngine } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';

const pluginName = 'zephyr-modernjs-plugin';

export function withZephyr(zephyrOptions?: ZephyrPluginOptions): CliPlugin<AppTools> {
  const isDev = process.env['NODE_ENV'] === 'development';

  return {
    name: pluginName,
    post: ['@modern-js/plugin-module-federation-config'],
    setup: async ({ useAppContext }) => {
      const appConfig = useAppContext();
      const zephyrEngine = await ZephyrEngine.create(appConfig.appDirectory);

      return {
        config: async () => {
          const dependencyPairs = extractFederatedDependencyPairs(appConfig);
          const resolvedDependencies =
            await zephyrEngine.resolve_remote_dependencies(dependencyPairs);

          mutWebpackFederatedRemotesConfig(appConfig, resolvedDependencies);

          return {
            tools: {
              rspack(config) {
                config.plugins?.push(
                  new ZeRspackPlugin({
                    zephyr_engine: zephyrEngine,
                    mfConfig: makeCopyOfModuleFederationOptions(appConfig),
                    wait_for_index_html: zephyrOptions?.wait_for_index_html,
                  })
                );
              },
            },
          };
        },
      };
    },
    usePlugins: isDev ? [zephyrFixPublicPath()] : [],
  };
}

/**
 * Creates a Modern.js CLI plugin that fixes the public path configuration for client-side
 * builds. This plugin modifies the Rspack configuration to set the publicPath to 'auto'
 * for non-server builds.
 *
 * ! Only required in development mode.
 *
 * @remarks
 *   The plugin is designed to work with Modern.js AppTools and specifically targets Rspack
 *   configuration. It only modifies the configuration when `isServer` is false.
 * @returns {CliPlugin<AppTools>} A Modern.js CLI plugin that adjusts the Rspack public
 *   path configuration
 */
function zephyrFixPublicPath(): CliPlugin<AppTools> {
  return {
    name: 'zephyr-publicpath-fix',
    pre: [pluginName],
    setup: async () => ({
      config: async () => ({
        tools: {
          rspack(config, { isServer }) {
            if (!isServer) {
              config.output = { ...config.output, publicPath: 'auto' };
            }
          },
        },
      }),
    }),
  };
}
