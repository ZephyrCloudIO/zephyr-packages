/**
 * Transformer Functions Index
 *
 * This file exports all AST transformation functions organized by category. Each category
 * handles a specific type of transformation pattern.
 */

// Core utilities - File I/O and detection
export { parseFile, writeFile, hasZephyrPlugin, skipAlreadyWrapped } from './core.js';

// Import management - ESM and CommonJS
export { addZephyrImport, addZephyrRequire } from './imports.js';

// Plugin array transformers - Adding to plugins arrays
export {
  addToPluginsArray,
  addToPluginsArrayOrCreate,
  addToComposePlugins,
} from './plugins-array.js';

// Vite-specific transformers
export { addToVitePlugins, addToVitePluginsInFunction } from './vite.js';

// Rollup-specific transformers
export { addToRollupFunction, addToRollupArrayConfig } from './rollup.js';

// Wrapper transformers - Wrapping exports with withZephyr
export {
  wrapModuleExports,
  wrapExportDefault,
  wrapExportedFunction,
} from './wrappers.js';

// JSON transformers - Non-AST transformations
export { addToParcelReporters } from './json.js';
