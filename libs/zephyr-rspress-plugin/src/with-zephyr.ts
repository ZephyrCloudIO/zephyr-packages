import {
  withZephyr as zephyrRsbuildPlugin,
  type ZephyrBuildHooks,
} from 'zephyr-rsbuild-plugin';
import { zephyrRspressSSGPlugin } from './zephyrRspressSSGPlugin';
import type {
  SSGConfig,
  RspressUserConfig,
  RspressPlugin,
  BuilderConfigWithPlugins,
} from './types';

export interface ZephyrRspressOptions {
  hooks?: ZephyrBuildHooks;
}

/**
 * Type guard to detect if rspress v1 API is being used v1 uses builderPlugins, v2 uses
 * builderConfig.plugins
 */
function isRspressV1<T extends RspressUserConfig>(
  config: T
): config is T & { builderPlugins: unknown[] } {
  return 'builderPlugins' in config;
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
        if (isRspressV1(config)) {
          // rspress v1: use builderPlugins
          config.builderPlugins = [
            ...config.builderPlugins,
            zephyrRsbuildPlugin(options),
          ];
        } else {
          // rspress v2: use builderConfig.plugins
          const existingPlugins = config.builderConfig?.plugins ?? [];
          const newBuilderConfig: BuilderConfigWithPlugins = {
            ...config.builderConfig,
            plugins: [...existingPlugins, zephyrRsbuildPlugin(options)],
          };
          (config as { builderConfig?: BuilderConfigWithPlugins }).builderConfig =
            newBuilderConfig;
        }
      }
      return config;
    },
  };
}
