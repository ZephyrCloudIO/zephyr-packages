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

  // Create the Zephyr Engine with deferred initialization
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();

  // Create the Zephyr Vite plugin
  const zephyrPlugin = new ZeVitePlugin({
    zephyr_engine: zephyr_engine_defer as unknown as ZephyrEngine,
    wait_for_index_html: userOptions?.wait_for_index_html,
    mfConfig: userOptions?.mfConfig,
  });

  // Initialize zephyr engine when needed
  // The actual context will be set in the configResolved hook
  zephyr_defer_create({
    builder: 'vite',
    context: process.cwd(),
  });

  // Add the Zephyr plugin to the array
  plugins.push(zephyrPlugin.getVitePlugin());

  return plugins;
}
