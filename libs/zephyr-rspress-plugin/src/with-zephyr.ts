import type { RspressPlugin } from '@rspress/shared';
import { zephyrRspressSSGPlugin } from './zephyrRspressSSGPlugin';
import { type ZeEnvVarsPluginOptions } from 'zephyr-xpack-internal';
import { zephyrRsbuildPlugin } from './zephyrRsbuildPlugin';
import { zeEnvVarsRsbuildPlugin } from './internal/env-variables/ze-env-vars-rsbuild-plugin';

export function withZephyr(envVarsOptions?: ZeEnvVarsPluginOptions): RspressPlugin {
  return {
    name: 'zephyr-rspress-plugin',
    async config(config, { addPlugin }) {
      config.builderPlugins ??= [];
      if (config.ssg) {
        config.builderPlugins.push(zeEnvVarsRsbuildPlugin(envVarsOptions));
        // addPlugin(zephyrRspressSSGPlugin({ outDir: config.outDir }));
      } else {
        config.builderPlugins?.push(zephyrRsbuildPlugin());
      }
      return config;
    },
  };
}
