import { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { AppTools, CliPlugin, CliPluginFuture } from '@modern-js/app-tools';
import { ZeRspackPlugin } from './ze-rspack-plugin';
import { zeBuildDashData, ZephyrEngine } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import { ZephyrInternalOptions } from '../type/zephyr-internal-types';
import * as path from 'path';
import { buffer } from 'node:stream/consumers';
import { withZephyr as zephyrRspack } from 'zephyr-rspack-plugin';
import { withZephyr as zephyrWebpack } from 'zephyr-webpack-plugin';

const pluginName = 'zephyr-modernjs-plugin';

// 1. main plugin (combination of plugins)
// 2. first plugin: pre runtime init - authentication, zephyr engine, mutate mf
// 3. second plugin: pre handling SSR
// 4. third plugin: post processing asset upload
export const withZephyr = (
  zephyrOptions?: ZephyrPluginOptions
): CliPluginFuture<AppTools<'rspack' | 'webpack'>> => ({
  name: pluginName,
  pre: ['@modern-js/plugin-module-federation-config'],

  setup: async (api) => {
    const appContext = api.getAppContext();
    const context = appContext.appDirectory;

    const zephyrEngine = await ZephyrEngine.create(context);
    const dependencyPairs = extractFederatedDependencyPairs({
      context: appContext.appDirectory,
    });
    const resolvedDependencies =
      await zephyrEngine.resolve_remote_dependencies(dependencyPairs);

    // mutWebpackFederatedRemotesConfig(zephyrEngine, appContext, resolvedDependencies);

    // const mfConfig = makeCopyOfModuleFederationOptions(appContext);

    api.config(() => {
      return {
        tools: {
          rspack: (config) => {
            // config.plugins?.push(zephyrRspack());
          },
          // webpack: (config) => {
          //   config.plugins?.push(zephyrWebpack());
          // },
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
