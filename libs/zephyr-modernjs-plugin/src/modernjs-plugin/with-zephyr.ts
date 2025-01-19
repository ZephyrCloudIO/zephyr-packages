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

export const withZephyr = (
  zephyrOptions?: ZephyrPluginOptions
): CliPlugin<AppTools<'rspack'>> => ({
  name: pluginName,
  post: ['@modern-js/plugin-module-federation-config'],

  setup: async ({ useAppContext }) => {
    const appContext = useAppContext();

    const zephyrEngine = await ZephyrEngine.create(appContext.appDirectory);

    return {
      beforeBuild: async ({ bundlerConfigs }) => {
        if (bundlerConfigs) {
          const dependencyPairs = extractFederatedDependencyPairs(bundlerConfigs[0]);
          console.log('dependency pairs', JSON.stringify(dependencyPairs, null, 3));

          const resolvedDependencies =
            await zephyrEngine.resolve_remote_dependencies(dependencyPairs);
          console.log('resolvedDeps', JSON.stringify(resolvedDependencies, null, 2));

          mutWebpackFederatedRemotesConfig(appContext, resolvedDependencies);

          const mfConfig = makeCopyOfModuleFederationOptions(bundlerConfigs[0]);

          bundlerConfigs[0].plugins?.push(
            new ZeRspackPlugin({
              zephyr_engine: zephyrEngine,
              mfConfig: mfConfig,
              wait_for_index_html: zephyrOptions?.wait_for_index_html,
            })
          );
        }
      },
    };
  },

  usePlugins: [zephyrFixPublicPath()],
});

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
