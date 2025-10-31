import type { RsbuildPlugin } from '@rsbuild/core';
import {
  withZephyr as rspackWithZephyr,
  type ZephyrBuildHooks,
} from 'zephyr-rspack-plugin';

export interface ZephyrRsbuildPluginOptions {
  wait_for_index_html?: boolean;
  hooks?: ZephyrBuildHooks;
}

export function withZephyr(options?: ZephyrRsbuildPluginOptions): RsbuildPlugin {
  return {
    name: 'zephyr-rsbuild-plugin',
    setup(api) {
      api.modifyRspackConfig(async (config) => {
        return await rspackWithZephyr(options)(config);
      });
    },
  };
}
