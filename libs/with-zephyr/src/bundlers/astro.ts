import type { BundlerConfig } from '../types.js';

export const astroConfig: BundlerConfig = {
  files: [
    'astro.config.js',
    'astro.config.ts',
    'astro.config.mjs',
    'astro.config.mts',
  ],
  plugin: 'zephyr-astro-integration',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: [
    'astro-integrations-function-or-create',
    'astro-integrations-or-create',
  ],
};
