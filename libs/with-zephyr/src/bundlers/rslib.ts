import type { BundlerConfig } from '../types.js';

export const rslibConfig: BundlerConfig = {
  files: [
    'rslib.config.js',
    'rslib.config.ts',
    'rslib.config.mjs',
    'rslib.config.cjs',
    'rslib.config.mts',
    'rslib.config.cts',
  ],
  plugin: 'zephyr-rsbuild-plugin',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: ['plugins-array'],
};
