// Main factory function
export { withZephyr, type ModuleFederationOptions } from './lib/vite-plugin-zephyr';

// Core plugin implementation (for advanced use cases)
export { ZeVitePlugin } from './lib/ze-vite-plugin';

// Type definitions
export type { ZephyrVitePluginOptions } from './lib/types';

// Legacy support for plugin variants
export { withZephyrPartial } from './lib/vite-plugin-zephyr-partial';
