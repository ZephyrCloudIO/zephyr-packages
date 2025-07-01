/**
 * ES Module wrapper for the Zephyr Next.js Adapter
 * 
 * This wrapper loads the CommonJS Zephyr adapter and exports it as an ES module
 * for compatibility with Next.js's experimental adapter API.
 */

import { createRequire } from 'module'
const require = createRequire(import.meta.url)

console.log('🚀 Zephyr Adapter Wrapper: Loading Zephyr Next.js Adapter...')

// Load the compiled Zephyr adapter
const zephyrAdapter = require('../../dist/libs/zephyr-nextjs-adapter/src/index.js').default

console.log('🚀 Zephyr Adapter Wrapper: Adapter loaded:', zephyrAdapter.name)

// Export as ES module default
export default zephyrAdapter