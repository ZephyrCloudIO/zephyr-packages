/**
 * Transformer Functions Index
 *
 * This file exports all AST transformation functions organized by category. Each category
 * handles a specific type of transformation pattern. The organization follows the
 * structure documented in the transformers README.
 */

// ========================================
// Category 1: Core Utilities
// ========================================
// File I/O, AST parsing, and detection functions

export { parseFile, writeFile, hasZephyrPlugin, skipAlreadyWrapped } from './core.js';

// ========================================
// Category 2: Import Management
// ========================================
// ESM and CommonJS import/require handling

export { addZephyrImport, addZephyrRequire } from './imports.js';

// ========================================
// Category 3: Plugin Array Transformers
// ========================================
// Functions for adding withZephyr to existing plugins arrays

export {
  addToPluginsArray,
  addToPluginsArrayOrCreate,
  addToComposePlugins,
} from './plugins-array.js';

// ========================================
// Category 4: Vite-Specific Transformers
// ========================================
// Transformers for Vite's defineConfig patterns

export { addToVitePlugins, addToVitePluginsInFunction } from './vite.js';

// ========================================
// Category 5: Astro-Specific Transformers
// ========================================
// Transformers for Astro's defineConfig patterns

export {
  addToAstroIntegrations,
  addToAstroIntegrationsInFunction,
  addToAstroIntegrationsOrCreate,
  addToAstroIntegrationsInFunctionOrCreate,
} from './astro.js';

// ========================================
// Category 6: Rollup-Specific Transformers
// ========================================
// Transformers for Rollup's config patterns

export { addToRollupFunction, addToRollupArrayConfig } from './rollup.js';

// ========================================
// Category 7: Wrapper Transformers
// ========================================
// Functions that wrap entire configs with withZephyr

export {
  wrapModuleExports,
  wrapExportDefault,
  wrapExportedFunction,
} from './wrappers.js';

// ========================================
// Category 8: JSON Transformers
// ========================================
// Non-AST transformations for JSON configs (e.g., Parcel)

export { addToParcelReporters } from './json.js';
