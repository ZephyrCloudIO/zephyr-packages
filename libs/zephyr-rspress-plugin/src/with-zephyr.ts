import type { RspressPlugin } from '@rspress/core';
import {
  withZephyr as zephyrRsbuildPlugin,
  type ZephyrBuildHooks,
} from 'zephyr-rsbuild-plugin';
import { zephyrRspressSSGPlugin } from './zephyrRspressSSGPlugin';

export interface ZephyrRspressOptions {
  hooks?: ZephyrBuildHooks;
}

export function withZephyr(options?: ZephyrRspressOptions): RspressPlugin {
  return {
    name: 'zephyr-rspress-plugin',
    async config(config, { addPlugin }) {
      const { ssg = false } = config;

      if (ssg) {
        addPlugin(zephyrRspressSSGPlugin(config, options));
      } else {
        config.builderConfig = {
          ...config.builderConfig,
          plugins: [
            ...(config.builderConfig?.plugins ?? []),
            zephyrRsbuildPlugin(options),
          ],
        };
      }
      return config;
    },
  };
}
