import type { BundlerConfig } from '../types.js';

export const viteConfig: BundlerConfig = {
  files: [
    'vite.config.js',
    'vite.config.ts',
    'vite.config.mjs',
    'vite.config.mts',
  ],
  plugin: 'vite-plugin-zephyr',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: ['plugins-array'],
};
