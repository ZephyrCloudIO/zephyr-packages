import { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { AppTools, CliPlugin } from '@modern-js/app-tools';
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
): CliPlugin<AppTools<'rspack' | 'webpack'>> => ({
  name: pluginName,
  pre: ['@modern-js/plugin-module-federation-config'],

  setup: async ({ useAppContext }) => {
    return {
      config: async () => {
        const appContext = useAppContext();
        const zephyrEngineOptions = {
          context: appContext.appDirectory,
          builder: appContext.bundlerType === 'rspack' ? 'rspack' : 'webpack',
        } as const;

        const zephyrEngine = await ZephyrEngine.create(zephyrEngineOptions);
        const dependencyPairs = extractFederatedDependencyPairs(appContext);

        const resolvedDependencies =
          await zephyrEngine.resolve_remote_dependencies(dependencyPairs);

        mutWebpackFederatedRemotesConfig(zephyrEngine, appContext, resolvedDependencies);

        const mfConfig = makeCopyOfModuleFederationOptions(appContext);

        return {
          tools: {
            rspack(config) {
              config.plugins?.push(
                new ZeRspackPlugin({
                  zephyr_engine: zephyrEngine,
                  mfConfig,
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
