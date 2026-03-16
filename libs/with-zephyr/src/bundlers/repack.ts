import type { BundlerConfig } from '../types.js';

export const repackConfig: BundlerConfig = {
  files: ['rspack.config.js', 'rspack.config.ts', 'rspack.config.mjs'],
  plugin: 'zephyr-repack-plugin',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: ['wrap-exported-function'],
};
