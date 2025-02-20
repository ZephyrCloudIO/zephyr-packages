import { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { AppTools, CliPluginFuture } from '@modern-js/app-tools';
import { withZephyr as withZephyrRspack } from 'zephyr-rspack-plugin';
import { withZephyr as withZephyrWebpack } from 'zephyr-webpack-plugin';

const pluginName = 'zephyr-modernjs-plugin';

const isDev = process.env['NODE_ENV'] === 'development';

export const withZephyr = (
  zephyrOptions?: ZephyrPluginOptions
): CliPluginFuture<AppTools<'rspack' | 'webpack'>> => ({
  name: pluginName,
  pre: ['@modern-js/plugin-module-federation-config'],

  setup(api) {
    api.modifyWebpackConfig(async (config, utils) => {
      const z_config = await withZephyrWebpack()(config);

      utils.mergeConfig(config, z_config);
    });
    api.modifyRspackConfig(async (config, utils) => {
      const z_config = await withZephyrRspack()(config);

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
          config.output = { ...config.output, publicPath: 'auto' };
        }
      });

      api.modifyRspackConfig(async (config, { isServer }) => {
        if (!isServer) {
          config.output = { ...config.output, publicPath: 'auto' };
        }
      });
    },
  };
}
