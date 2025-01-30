import { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { AppTools, CliPlugin } from '@modern-js/app-tools';
import { ZeModernjsPlugin } from './ze-modernjs-plugin';
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
    const appContext = useAppContext();
    const zephyrEngineOptions = {
      context: appContext.appDirectory,
      builder: appContext.bundlerType === 'rspack' ? 'rspack' : 'webpack',
    } as const;

    const zephyrEngine = await ZephyrEngine.create(zephyrEngineOptions);

    return {
      config: async () => {
        const dependencyPairs = extractFederatedDependencyPairs(appContext);
        const resolvedDependencies =
          await zephyrEngine.resolve_remote_dependencies(dependencyPairs);

        mutWebpackFederatedRemotesConfig(zephyrEngine, appContext, resolvedDependencies);

        const mfConfig = makeCopyOfModuleFederationOptions(appContext);

        return {
          tools: {
            webpack(config) {
              config.plugins?.push(
                // @ts-expect-error Probably should change for Webpack ?
                new ZeModernjsPlugin({
                  zephyr_engine: zephyrEngine,
                  mfConfig,
                  wait_for_index_html: zephyrOptions?.wait_for_index_html,
                })
              );
            },
            rspack(config) {
              config.plugins?.push(
                new ZeModernjsPlugin({
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
