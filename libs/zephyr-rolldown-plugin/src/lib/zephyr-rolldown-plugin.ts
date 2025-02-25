import type { Plugin } from 'rolldown';
import { ZephyrEngine } from 'zephyr-agent';
import { ZeRolldownPlugin } from './ze-rolldown-plugin';
import { ZephyrRolldownPluginOptions } from './types';
import { cwd } from 'node:process';

/**
 * Factory function to create a Rolldown plugin with Zephyr integration
 *
 * @param userOptions - Optional Rolldown-specific Zephyr options
 * @returns A Rolldown plugin configuration
 */
export function withZephyr(userOptions: ZephyrRolldownPluginOptions = {}): Plugin {
  // Create the Zephyr Engine with deferred initialization
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  // Create the plugin instance
  const plugin = new ZeRolldownPlugin({
    zephyr_engine: zephyr_engine_defer as unknown as ZephyrEngine,
    wait_for_index_html: userOptions.wait_for_index_html,
    mfConfig: userOptions.mfConfig,
  });

  // Initialize zephyr engine when rolldown is started
  zephyr_defer_create({
    builder: 'rollup', // Using rollup builder type as they share the same API
    context: cwd(), // This will be updated in buildStart hook
  });

  // Return the Rolldown plugin configuration
  return plugin.getRolldownPlugin();
}
