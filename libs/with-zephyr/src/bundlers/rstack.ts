import type { BundlerConfig } from '../types.js';

export const rstackConfig: BundlerConfig = {
  files: [
    'rstack.config.ts',
    'rstack.config.js',
    'rstack.config.mts',
    'rstack.config.mjs',
  ],
  plugin: 'zephyr-rsbuild-plugin',
  importName: null,
  strategy: 'first-success',
  operations: ['rstack-plugins'],
};
