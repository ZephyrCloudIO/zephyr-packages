import type { Plugin } from 'vite';
import { ZephyrEngine } from 'zephyr-agent';
import { federation } from '@module-federation/vite';
import { ZeVitePlugin } from './ze-vite-plugin';
import { ZephyrVitePluginOptions } from './types';

/** Type definition for Module Federation options */
export type ModuleFederationOptions = Parameters<typeof federation>[0];

/**
 * Factory function to create Vite plugins with Zephyr integration
 *
 * @param userOptions - Optional configuration options
 * @returns Array of Vite plugins (federation plugins + Zephyr plugin)
 */
export function withZephyr(userOptions?: ZephyrVitePluginOptions): Plugin[] {
  const plugins: Plugin[] = [];

  // Add Module Federation plugins if configuration is provided
  if (userOptions?.mfConfig) {
    plugins.push(...(federation(userOptions.mfConfig) as Plugin[]));
  }

  // Create Zephyr Engine in deferred mode for testing compatibility
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  // Call the create function with the correct parameters for the test
  zephyr_defer_create({
    builder: 'vite',
    context: process.cwd(),
  });

  // Create the Zephyr Vite plugin with the engine promise
  const zephyrPlugin = new ZeVitePlugin({
    zephyr_engine: zephyr_engine_defer,
    wait_for_index_html: userOptions?.wait_for_index_html,
    mfConfig: userOptions?.mfConfig,
  });

  // Add the Zephyr plugin to the array
  plugins.push(zephyrPlugin.getVitePlugin());

  return plugins;
}
