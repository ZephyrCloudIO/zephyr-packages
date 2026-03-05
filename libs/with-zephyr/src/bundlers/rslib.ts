import type { BundlerConfig } from '../types.js';

export const rslibConfig: BundlerConfig = {
  files: ['rslib.config.js', 'rslib.config.ts', 'rslib.config.mjs'],
  plugin: 'zephyr-rsbuild-plugin',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: ['plugins-array'],
};
