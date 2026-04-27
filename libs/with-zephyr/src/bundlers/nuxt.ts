import type { BundlerConfig } from '../types.js';

export const nuxtConfig: BundlerConfig = {
  files: [
    'nuxt.config.js',
    'nuxt.config.ts',
    'nuxt.config.mjs',
    'nuxt.config.mts',
  ],
  plugin: 'zephyr-nuxt-module',
  importName: null,
  strategy: 'first-success',
  operations: ['nuxt-modules-or-create'],
};
