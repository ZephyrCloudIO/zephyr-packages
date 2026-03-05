import type { BundlerConfig } from '../types.js';

export const rspressConfig: BundlerConfig = {
  files: ['rspress.config.js', 'rspress.config.ts', 'rspress.config.mjs'],
  plugin: 'zephyr-rspress-plugin',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: ['plugins-array-or-create', 'plugins-array'],
};
