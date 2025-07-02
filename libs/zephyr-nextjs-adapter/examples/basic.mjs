/**
 * Basic Zephyr Next.js Adapter Example
 *
 * This example shows the simplest way to use the Zephyr adapter with default
 * configuration.
 */

// Import the default adapter
import zephyrAdapter from 'zephyr-nextjs-adapter';

// Export the adapter for Next.js to use
export default zephyrAdapter;

/*
Usage in next.config.js:

module.exports = {
  experimental: {
    adapterPath: './examples/basic.mjs'
  }
}
*/
