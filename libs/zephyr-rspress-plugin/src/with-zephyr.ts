import {
  withZephyr as zephyrRsbuildPlugin,
  type ZephyrBuildHooks,
} from 'zephyr-rsbuild-plugin';
import { zephyrRspressSSGPlugin } from './zephyrRspressSSGPlugin';
import type { SSGConfig, RspressUserConfig, RspressPlugin } from './types';

export interface ZephyrRspressOptions {
  hooks?: ZephyrBuildHooks;
}

/**
 * Type guard to detect if rspress v2 API is available v2 uses builderConfig.plugins, v1
 * uses builderPlugins
 */
function isRspressV2<T extends RspressUserConfig>(
  config: T
): config is T & { builderConfig?: { plugins?: unknown[] } } {
  return 'builderConfig' in config || !('builderPlugins' in config);
}

/** Type guard to check if SSG is enabled (can be boolean or object with options) */
function isSsgEnabled(
  ssg: SSGConfig | undefined
): ssg is SSGConfig & (true | Record<string, unknown>) {
  return ssg === true || (typeof ssg === 'object' && ssg !== null);
}

/**
 * Creates a Zephyr plugin for Rspress that works with both v1 and v2
 *
 * @example
 *   ```ts
 *   // rspress.config.ts (v1)
 *   import { defineConfig } from 'rspress/config';
 *   import { withZephyr } from 'zephyr-rspress-plugin';
 *
 *   export default defineConfig({
 *     plugins: [withZephyr()],
 *   });
 *   ```;
 *
 * @example
 *   ```ts
 *   // rspress.config.ts (v2)
 *   import { defineConfig } from '@rspress/core';
 *   import { withZephyr } from 'zephyr-rspress-plugin';
 *
 *   export default defineConfig({
 *     plugins: [withZephyr()],
 *   });
 *   ```;
 */
export function withZephyr<TConfig extends RspressUserConfig = RspressUserConfig>(
  options?: ZephyrRspressOptions
): RspressPlugin<TConfig> {
  return {
    name: 'zephyr-rspress-plugin',
    async config(config, { addPlugin }) {
      const { ssg } = config;

      if (isSsgEnabled(ssg)) {
        addPlugin(zephyrRspressSSGPlugin(config, options) as RspressPlugin<TConfig>);
      } else {
        // Support both rspress v1 (builderPlugins) and v2 (builderConfig.plugins)
        if (isRspressV2(config)) {
          // rspress v2: use builderConfig.plugins
          config.builderConfig = {
            ...config.builderConfig,
            plugins: [
              ...(config.builderConfig?.plugins ?? []),
              zephyrRsbuildPlugin(options),
            ],
          };
        } else {
          // rspress v1: use builderPlugins
          (config as RspressUserConfig).builderPlugins = [
            ...((config as RspressUserConfig).builderPlugins ?? []),
            zephyrRsbuildPlugin(options),
          ];
        }
      }
      return config;
    },
  };
}
