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
      // @ts-expect-error Webpack version type mismatch between @modern-js/app-tools and zephyr-webpack-plugin
      const z_config = await withZephyr(zephyrOptions)(config);
      // @ts-expect-error Webpack version type mismatch between @modern-js/app-tools and zephyr-webpack-plugin
      utils.mergeConfig(config, z_config);
    });

    api.modifyRspackConfig(async (config, utils) => {
      const currentBundler = api.getAppContext().bundlerType;
      if (currentBundler !== 'rspack') {
        return;
      }

      const { withZephyr } = await import('zephyr-rspack-plugin');
      // @ts-expect-error Rspack version type mismatch between @modern-js/app-tools and zephyr-rspack-plugin
      const z_config = await withZephyr(zephyrOptions)(config);
      // @ts-expect-error Rspack version type mismatch between @modern-js/app-tools and zephyr-rspack-plugin
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
