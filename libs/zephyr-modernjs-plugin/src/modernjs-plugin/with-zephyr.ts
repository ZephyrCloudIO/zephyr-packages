import type { AppTools, CliPlugin } from '@modern-js/app-tools';
import { ze_log } from 'zephyr-agent';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';

const pluginName = 'zephyr-modernjs-plugin';
const isDev = process.env['NODE_ENV'] === 'development';

export const withZephyr = (zephyrOptions?: ZephyrPluginOptions): CliPlugin<AppTools> => ({
  name: pluginName,
  pre: ['@modern-js/plugin-module-federation-config'],

  async setup(api) {
    api['modifyRspackConfig'](async (config) => {
      const { withZephyr } = await import('zephyr-rspack-plugin');
      return await withZephyr(zephyrOptions)(config);
    });
  },

  usePlugins: isDev ? [zephyrFixPublicPath()] : [],
});

function zephyrFixPublicPath(): CliPlugin<AppTools> {
  return {
    name: 'zephyr-publicpath-fix',
    pre: [pluginName],
    setup(api) {
      api['modifyRspackConfig'](async (config, { isServer }) => {
        if (!isServer) {
          ze_log.misc('Modifying publicPath for Dev Server');
          config.output = { ...config.output, publicPath: 'auto' };
        }
      });
    },
  };
}
