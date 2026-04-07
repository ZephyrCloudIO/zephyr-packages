import type { BundlerConfig } from '../types.js';

export const modernjsConfig: BundlerConfig = {
  files: ['modern.config.js', 'modern.config.ts', 'modern.config.mjs'],
  plugin: 'zephyr-modernjs-plugin',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: ['plugins-array-or-create', 'plugins-array'],
};
