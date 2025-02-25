// Main factory function
export { withZephyr } from './lib/with-zephyr';

// Core plugin implementation (for advanced use cases)
export { ZeRepackPlugin } from './lib/ze-base-repack-plugin';

// Type definitions
export type { ZephyrRepackPluginOptions } from './lib/types';

// Legacy exports (deprecated, for backward compatibility only)
export { ZeRepackPlugin as ZeLegacyRepackPlugin } from './lib/ze-repack-plugin';
export type { ZephyrRepackPluginOptions as ZeLegacyRepackPluginOptions } from './lib/ze-repack-plugin';
