import type { Plugin } from 'rollup';
import { ZephyrEngine } from 'zephyr-agent';
import { ZeRollupPlugin } from './ze-rollup-plugin';
import { ZephyrRollupPluginOptions } from './types';
import { cwd } from 'node:process';

/**
 * Factory function to create a Rollup plugin with Zephyr integration
 *
 * @param userOptions - Optional Rollup-specific Zephyr options
 * @returns A Rollup plugin configuration
 */
export function withZephyr(userOptions: ZephyrRollupPluginOptions = {}): Plugin {
  // Create the Zephyr Engine with deferred initialization
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  // Create the plugin instance - pass the promise directly
  const plugin = new ZeRollupPlugin({
    zephyr_engine: zephyr_engine_defer, // Pass the promise directly
    wait_for_index_html: userOptions.wait_for_index_html,
    mfConfig: userOptions.mfConfig,
  });

  // Initialize zephyr engine when rollup is started
  zephyr_defer_create({
    builder: 'rollup',
    context: cwd(), // This will be updated in buildStart hook
  });

  // Return the Rollup plugin configuration
  return plugin.getRollupPlugin();
}
