import {
  withZephyr as zephyrRsbuildPlugin,
  type ZephyrBuildHooks,
} from 'zephyr-rsbuild-plugin';
import { zephyrRspressSSGPlugin } from './zephyrRspressSSGPlugin';

export interface ZephyrRspressOptions {
  hooks?: ZephyrBuildHooks;
}

/**
 * Detects if rspress v2 API is available by checking for builderConfig property or if
 * builderPlugins is not present (v2 removed builderPlugins)
 */
function isRspressV2(config: Record<string, unknown>): boolean {
  return 'builderConfig' in config || !('builderPlugins' in config);
}

/** Check if SSG is enabled (can be boolean or object with options) */
function isSsgEnabled(ssg: unknown): boolean {
  return ssg === true || (typeof ssg === 'object' && ssg !== null);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withZephyr(options?: ZephyrRspressOptions): any {
  return {
    name: 'zephyr-rspress-plugin',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async config(config: any, { addPlugin }: { addPlugin: (plugin: any) => void }) {
      const { ssg } = config;

      if (isSsgEnabled(ssg)) {
        addPlugin(zephyrRspressSSGPlugin(config, options));
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
          config.builderPlugins = [
            ...(config.builderPlugins ?? []),
            zephyrRsbuildPlugin(options),
          ];
        }
      }
      return config;
    },
  };
}
