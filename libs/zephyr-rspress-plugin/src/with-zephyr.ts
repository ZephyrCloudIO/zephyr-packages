import type { RspressPlugin } from '@rspress/shared';
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
        config.builderPlugins = [
          ...(config.builderPlugins ?? []),
          zephyrRsbuildPlugin(options),
        ];
      }
      return config;
    },
  };
}
