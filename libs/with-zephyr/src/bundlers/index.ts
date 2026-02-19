import type { BundlerConfigs } from '../types.js';
import { astroConfig } from './astro.js';
import { modernjsConfig } from './modernjs.js';
import { parcelConfig } from './parcel.js';
import { repackConfig } from './repack.js';
import { rolldownConfig } from './rolldown.js';
import { rollupConfig } from './rollup.js';
import { rsbuildConfig } from './rsbuild.js';
import { rslibConfig } from './rslib.js';
import { rspackConfig } from './rspack.js';
import { rspressConfig } from './rspress.js';
import { viteConfig } from './vite.js';
import { webpackConfig } from './webpack.js';

/**
 * Registry of all supported bundler configurations
 *
 * Each bundler configuration defines:
 *
 * - Files: Config file patterns to search for
 * - Plugin: Package name to install
 * - ImportName: Function name to import (null for JSON configs)
 * - Patterns: Ordered list of transformation patterns to try
 *
 * To add a new bundler:
 *
 * 1. Create a new file in src/bundlers/{bundler}.ts
 * 2. Export a {bundler}Config constant
 * 3. Import and add it to BUNDLER_CONFIGS below
 * 4. Add transformer functions if needed in src/transformers.ts
 */
export const BUNDLER_CONFIGS: BundlerConfigs = {
  // JavaScript bundlers
  webpack: webpackConfig,
  rspack: rspackConfig,
  vite: viteConfig,
  rollup: rollupConfig,
  rolldown: rolldownConfig,

  // Build tools
  rsbuild: rsbuildConfig,
  rslib: rslibConfig,
  parcel: parcelConfig,

  // Framework-specific
  astro: astroConfig,
  modernjs: modernjsConfig,
  rspress: rspressConfig,

  // React Native
  repack: repackConfig,
};

// Re-export individual bundler configs for direct imports
export { webpackConfig } from './webpack.js';
export { rspackConfig } from './rspack.js';
export { viteConfig } from './vite.js';
export { rollupConfig } from './rollup.js';
export { rolldownConfig } from './rolldown.js';
export { rsbuildConfig } from './rsbuild.js';
export { rslibConfig } from './rslib.js';
export { parcelConfig } from './parcel.js';
export { astroConfig } from './astro.js';
export { modernjsConfig } from './modernjs.js';
export { rspressConfig } from './rspress.js';
export { repackConfig } from './repack.js';
