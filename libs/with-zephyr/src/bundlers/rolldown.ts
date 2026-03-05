import type { BundlerConfig } from '../types.js';

export const rolldownConfig: BundlerConfig = {
  files: ['rolldown.config.js', 'rolldown.config.ts', 'rolldown.config.mjs'],
  plugin: 'zephyr-rolldown-plugin',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: ['plugins-array-or-create', 'plugins-array'],
};
