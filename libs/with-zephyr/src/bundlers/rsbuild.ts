import type { BundlerConfig } from '../types.js';

export const rsbuildConfig: BundlerConfig = {
  files: ['rsbuild.config.js', 'rsbuild.config.ts', 'rsbuild.config.mjs'],
  plugin: 'zephyr-rsbuild-plugin',
  importName: 'withZephyr',
  strategy: 'run-all',
  operations: ['plugins-array-or-create', 'rsbuild-asset-prefix'],
};
