import type { BundlerConfig } from '../types.js';

export const rollupConfig: BundlerConfig = {
  files: ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs'],
  plugin: 'rollup-plugin-zephyr',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: ['rollup-array', 'rollup-function', 'plugins-array'],
};
