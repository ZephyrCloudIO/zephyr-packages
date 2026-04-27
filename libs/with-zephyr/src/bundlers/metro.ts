import type { BundlerConfig } from '../types.js';

export const metroConfig: BundlerConfig = {
  files: [
    'metro.config.js',
    'metro.config.ts',
    'metro.config.mjs',
    'metro.config.cjs',
  ],
  plugin: 'zephyr-metro-plugin',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: ['wrap-module-exports-async', 'wrap-export-default-async'],
};
