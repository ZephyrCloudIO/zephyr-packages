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
  return {
    name: pluginName,
    post: ['@modern-js/plugin-module-federation-config'],
    setup: async ({ useAppContext }) => {
      const appConfig = useAppContext();
      const executionDir = appConfig.appDirectory;

      // Initialize ZephyrEngine
      const zephyrEngine = await ZephyrEngine.create(executionDir);

      return {
        config: async () => {
          // Extract and resolve federated dependency pairs
          const dependencyPairs = extractFederatedDependencyPairs(appConfig);
          const resolvedDependencies =
            await zephyrEngine.resolve_remote_dependencies(dependencyPairs);

          // Mutate remotes configuration
          mutWebpackFederatedRemotesConfig(appConfig, resolvedDependencies);

          return {
            tools: {
              rspack(config) {
                // Inject the ZeWebpackPlugin
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
    usePlugins: [zephyrFixPublicPath()],
  };
}

function zephyrFixPublicPath(): CliPlugin<AppTools> {
  return {
    name: 'zephyr-publicpath-fix',
    pre: [pluginName],
    setup: async () => {
      return {
        config: async () => {
          return {
            tools: {
              rspack(config, { isServer }) {
                if (!isServer) {
                  config.output = {
                    ...config.output,
                    publicPath: 'auto',
                  };
                }
              },
            },
          };
        },
      };
    },
  };
}
