import type { BundlerConfig } from '../types.js';

export const rspackConfig: BundlerConfig = {
  files: ['rspack.config.js', 'rspack.config.ts', 'rspack.config.mjs'],
  plugin: 'zephyr-rspack-plugin',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: [
    'wrap-export-default-define-config',
    'compose-plugins',
    'wrap-export-default-object',
    'plugins-array',
    'wrap-module-exports',
  ],
};
