import type { AppTools, CliPluginFuture } from '@modern-js/app-tools';
import { ze_log } from 'zephyr-agent';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';

const pluginName = 'zephyr-modernjs-plugin';
const isDev = process.env['NODE_ENV'] === 'development';

export const withZephyr = (
  zephyrOptions?: ZephyrPluginOptions
): CliPluginFuture<AppTools<'rspack' | 'webpack'>> => ({
  name: pluginName,
  pre: ['@modern-js/plugin-module-federation-config'],

  async setup(api) {
    api.modifyWebpackConfig(async (config) => {
      const currentBundler = api.getAppContext().bundlerType;
      if (currentBundler !== 'webpack') {
        return;
      }

      const { withZephyr } = await import('zephyr-webpack-plugin');
      return await withZephyr(zephyrOptions)(config);
    });

    api.modifyRspackConfig(async (config) => {
      const currentBundler = api.getAppContext().bundlerType;
      if (currentBundler !== 'rspack') {
        return;
      }

      const { withZephyr } = await import('zephyr-rspack-plugin');
      return await withZephyr(zephyrOptions)(config);
    });
  },

  usePlugins: isDev ? [zephyrFixPublicPath()] : [],
});

function zephyrFixPublicPath(): CliPluginFuture<AppTools> {
  return {
    name: 'zephyr-publicpath-fix',
    pre: [pluginName],
    setup(api) {
      api.modifyWebpackConfig(async (config, { isServer }) => {
        if (!isServer) {
          ze_log.misc('Modifying publicPath for Dev Server');
          config.output = { ...config.output, publicPath: 'auto' };
        }
      });

      api.modifyRspackConfig(async (config, { isServer }) => {
        if (!isServer) {
          ze_log.misc('Modifying publicPath for Dev Server');
          config.output = { ...config.output, publicPath: 'auto' };
        }
      });
    },
  };
}
