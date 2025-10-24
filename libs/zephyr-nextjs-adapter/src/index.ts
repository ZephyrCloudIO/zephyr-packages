/**
 * Zephyr Next.js Adapter
 *
 * Main entry point for the Zephyr Next.js Adapter library. Uses CommonJS exports for
 * proper Next.js compatibility.
 */

import zephyrAdapter from './lib/zephyr-nextjs-adapter';

// Export the adapter directly as module.exports for Next.js compatibility
module.exports = zephyrAdapter;

// Also provide named exports for flexibility (but Next.js uses module.exports)
module.exports.zephyrAdapter = zephyrAdapter;
module.exports.createZephyrAdapter = require('./lib/adapter-factory').createZephyrAdapter;

// Export types and utils
export * from './lib/types';
export * from './lib/utils';
