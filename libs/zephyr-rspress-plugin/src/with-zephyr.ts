import {
  withZephyr as zephyrRsbuildPlugin,
  type ZephyrBuildHooks,
} from 'zephyr-rsbuild-plugin';
import { zephyrRspressSSGPlugin } from './zephyrRspressSSGPlugin';

export interface ZephyrRspressOptions {
  hooks?: ZephyrBuildHooks;
}

interface RspressConfigV1 {
  ssg?: boolean;
  builderPlugins?: unknown[];
  [key: string]: unknown;
}

interface RspressConfigV2 {
  ssg?: boolean;
  builderConfig?: {
    plugins?: unknown[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

type RspressConfig = RspressConfigV1 & RspressConfigV2;

interface RspressPlugin {
  name: string;
  config?: (
    config: RspressConfig,
    utils: { addPlugin: (plugin: RspressPlugin) => void }
  ) => RspressConfig | Promise<RspressConfig>;
}

/**
 * Detects if rspress v2 API is available by checking for builderConfig property or if
 * builderPlugins is not present (v2 removed builderPlugins)
 */
function isRspressV2(config: RspressConfig): boolean {
  return 'builderConfig' in config || !('builderPlugins' in config);
}

export function withZephyr(options?: ZephyrRspressOptions): RspressPlugin {
  return {
    name: 'zephyr-rspress-plugin',
    async config(config, { addPlugin }) {
      const { ssg = false } = config;

      if (ssg) {
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
