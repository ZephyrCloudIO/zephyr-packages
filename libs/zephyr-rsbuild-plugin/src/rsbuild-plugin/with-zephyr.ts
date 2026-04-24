import type { RsbuildPlugin } from '@rsbuild/core';
import {
  withZephyr as rspackWithZephyr,
  type ZephyrBuildHooks,
} from 'zephyr-rspack-plugin';

export interface ZephyrRsbuildPluginOptions {
  wait_for_index_html?: boolean;
  hooks?: ZephyrBuildHooks;
}

type RspackWithZephyrConfig = Parameters<ReturnType<typeof rspackWithZephyr>>[0];

export function withZephyr(options?: ZephyrRsbuildPluginOptions): RsbuildPlugin {
  return {
    name: 'zephyr-rsbuild-plugin',
    setup(api) {
      // Per Rspack team: @module-federation/rsbuild-plugin adds MF plugins in onBeforeCreateCompiler,
      // which runs AFTER modifyRspackConfig. So we must process the configs in onBeforeCreateCompiler
      // where the MF plugins are already present.
      // Using order: 'post' ensures we run after the MF plugin has set up the config.
      api.onBeforeCreateCompiler({
        order: 'post',
        handler: async ({ bundlerConfigs }) => {
          // Process each bundler config (one per environment)
          for (const config of bundlerConfigs) {
            // Rsbuild and the rspack plugin can resolve compatible patch versions
            // of @rspack/core independently, which makes their config types nominally
            // incompatible in TS even though the runtime config shape is the same.
            const rspackConfig = config as RspackWithZephyrConfig;

            // Apply Zephyr's rspack transformation
            // The real MF plugin is already present in the config and rspackWithZephyr will extract from it
            const result = await rspackWithZephyr(options)(rspackConfig);

            // Merge result back (rspackWithZephyr may return a new config or void)
            if (result) {
              Object.assign(config, result);
            }
          }
        },
      });
    },
  };
}
