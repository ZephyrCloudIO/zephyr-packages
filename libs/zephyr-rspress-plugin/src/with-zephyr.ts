import {
  withZephyr as zephyrRsbuildPlugin,
  type ZephyrBuildHooks,
} from 'zephyr-rsbuild-plugin';
import { assertZephyrBuildTarget } from 'zephyr-edge-contract';
import type { ZephyrBuildTarget } from 'zephyr-agent';
import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import { zephyrRspressSSGPlugin } from './zephyrRspressSSGPlugin';
import { moduleFederationPublicPathPlugin } from './internal/assets/moduleFederationPublicPathPlugin';
import type {
  SSGConfig,
  RspressUserConfig,
  RspressPlugin,
  BuilderConfigWithPlugins,
  ZephyrRspressSSGOptions,
} from './types';

export interface ZephyrRspressOptions {
  /** Zephyr artifact family, including `tap-app` for TAP packages. */
  target?: ZephyrBuildTarget;
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
  if (options?.target !== undefined) {
    assertZephyrBuildTarget(options.target, 'withZephyr({ target })');
  }

  // Rspress materializes one configuration per compiler. Keep all of their federation
  // plugins in this mutable collection so the SSG hook can forward the complete set to
  // xpack after the build, when snapshot and dashboard metadata are produced.
  const mfConfigs: ModuleFederationPlugin[] = [];
  const portableFederationPlugin = moduleFederationPublicPathPlugin({
    target: options?.target,
    onModuleFederationPlugins(plugins) {
      mfConfigs.splice(0, mfConfigs.length, ...plugins);
    },
  });

  return {
    name: 'zephyr-rspress-plugin',
    async config(config, { addPlugin }) {
      const { ssg } = config;

      if (isSsgEnabled(ssg)) {
        if (isRspressV1(config)) {
          const existingPlugins = config.builderPlugins ?? [];
          if (!existingPlugins.some((plugin) => plugin === portableFederationPlugin)) {
            config.builderPlugins = [...existingPlugins, portableFederationPlugin];
          }
        } else {
          const existingPlugins = config.builderConfig?.plugins ?? [];
          const newBuilderConfig: BuilderConfigWithPlugins = {
            ...config.builderConfig,
            plugins: existingPlugins.some((plugin) => plugin === portableFederationPlugin)
              ? existingPlugins
              : [...existingPlugins, portableFederationPlugin],
          };
          (config as { builderConfig?: BuilderConfigWithPlugins }).builderConfig =
            newBuilderConfig;
        }
        const ssgOptions: ZephyrRspressSSGOptions = {
          ...options,
          mfConfig: mfConfigs,
        };
        addPlugin(zephyrRspressSSGPlugin(config, ssgOptions) as RspressPlugin<TConfig>);
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
