import type { AppTools, CliPlugin } from '@modern-js/app-tools';
import { ze_log, type ZephyrBuildHooks } from 'zephyr-agent';

const pluginName = 'zephyr-modernjs-plugin';
const isDev = process.env['NODE_ENV'] === 'development';

export interface ZephyrModernjsPluginOptions {
  wait_for_index_html?: boolean;
  hooks?: ZephyrBuildHooks;
  /** Override automatic CSR/SSR detection for Modern.js compiler arrays. */
  snapshotType?: 'csr' | 'ssr';
  /** Server entrypoint relative to the shared compiler output root. */
  entrypoint?: string;
}

export const withZephyr = (
  zephyrOptions?: ZephyrModernjsPluginOptions
): CliPlugin<AppTools> => ({
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
