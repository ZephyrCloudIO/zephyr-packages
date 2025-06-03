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
    api.modifyWebpackConfig(async (config, utils) => {
      const currentBundler = api.getAppContext().bundlerType;
      if (currentBundler !== 'webpack') {
        return;
      }

      const { withZephyr } = await import('zephyr-webpack-plugin');
      const z_config = await withZephyr(zephyrOptions)(config);
      /* eslint-disable-next-line */
      utils.mergeConfig(config as any, z_config as any);
    });

    api.modifyRspackConfig(async (config, utils) => {
      const currentBundler = api.getAppContext().bundlerType;
      if (currentBundler !== 'rspack') {
        return;
      }

      const { withZephyr } = await import('zephyr-rspack-plugin');
      const z_config = await withZephyr(zephyrOptions)(config);
      utils.mergeConfig(config, z_config);
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
          ze_log('Modifying publicPath for Dev Server');
          config.output = { ...config.output, publicPath: 'auto' };
        }
      });

      api.modifyRspackConfig(async (config, { isServer }) => {
        if (!isServer) {
          ze_log('Modifying publicPath for Dev Server');
          config.output = { ...config.output, publicPath: 'auto' };
        }
      });
    },
  };
}
