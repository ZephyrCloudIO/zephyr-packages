import type { AppTools, CliPlugin } from '@modern-js/app-tools';
import {
  assertZephyrBuildTarget,
  ze_log,
  type ZephyrBuildHooks,
  type ZephyrBuildTarget,
} from 'zephyr-agent';

const pluginName = 'zephyr-modernjs-plugin';
const isDev = process.env['NODE_ENV'] === 'development';

/**
 * The development-server workaround rewrites emitted runtime behavior. A TAP package
 * carries SDK-locked output, so it must never opt into that rewrite.
 */
export function shouldApplyDevPublicPathFix(
  target: ZephyrBuildTarget | undefined,
  development = isDev
): boolean {
  return development && target !== 'tap-app';
}

export interface ZephyrModernjsPluginOptions {
  /** Zephyr build target, including the `tap-app` mini-app artifact family. */
  target?: ZephyrBuildTarget;
  /** Explicit URL for this application's `zephyr-manifest.json`. */
  zephyrManifestUrl?: string;
  wait_for_index_html?: boolean;
  hooks?: ZephyrBuildHooks;
  /** Override automatic CSR/SSR detection for Modern.js compiler arrays. */
  snapshotType?: 'csr' | 'ssr';
  /** Server entrypoint relative to the shared compiler output root. */
  entrypoint?: string;
}

export const withZephyr = (
  zephyrOptions?: ZephyrModernjsPluginOptions
): CliPlugin<AppTools> => {
  if (zephyrOptions?.target !== undefined) {
    assertZephyrBuildTarget(zephyrOptions.target, 'withZephyr({ target })');
  }

  return {
    name: pluginName,
    pre: ['@modern-js/plugin-module-federation-config'],

    async setup(api) {
      api['modifyRspackConfig'](async (config) => {
        const { withZephyr } = await import('zephyr-rspack-plugin');
        return await withZephyr(zephyrOptions)(config);
      });
    },

    usePlugins: shouldApplyDevPublicPathFix(zephyrOptions?.target)
      ? [zephyrFixPublicPath(zephyrOptions?.target)]
      : [],
  };
};

function zephyrFixPublicPath(target: ZephyrBuildTarget | undefined): CliPlugin<AppTools> {
  return {
    name: 'zephyr-publicpath-fix',
    pre: [pluginName],
    setup(api) {
      api['modifyRspackConfig'](async (config, { isServer }) => {
        if (!isServer && target !== 'tap-app') {
          ze_log.misc('Modifying publicPath for Dev Server');
          config.output = { ...config.output, publicPath: 'auto' };
        }
      });
    },
  };
}
