import type { AppTools, CliPluginFuture, webpack } from '@modern-js/app-tools';
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
): CliPluginFuture<AppTools<'rspack' | 'webpack'>> => ({
  name: pluginName,
  pre: ['@modern-js/plugin-module-federation-config'],

  async setup(api) {
    api.onBeforeCreateCompiler(async ({ bundlerConfigs }) => {
      if (!bundlerConfigs || bundlerConfigs.length === 0) {
        return;
      }
      const currentBundler = api.getAppContext().bundlerType;
      if (currentBundler === 'webpack') {
        const { withZephyr } = await import('zephyr-webpack-plugin');
        await withZephyr(zephyrOptions)(
          bundlerConfigs as unknown as webpack.Configuration[]
        );
      } else if (currentBundler === 'rspack') {
        const { withZephyr } = await import('zephyr-rspack-plugin');
        await withZephyr(zephyrOptions)(bundlerConfigs);
      }
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
