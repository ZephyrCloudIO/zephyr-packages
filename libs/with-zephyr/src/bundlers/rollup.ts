import type { BundlerConfig } from '../types.js';

export const rollupConfig: BundlerConfig = {
  files: ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs'],
  plugin: 'rollup-plugin-zephyr',
  importName: 'withZephyr',
  patterns: [
    {
      type: 'export-array',
      matcher: /export\s+default\s+\[/,
      transform: 'addToRollupArrayConfig',
    },
    {
      type: 'module-exports-function',
      matcher: /module\.exports\s*=\s*\(\s*config\s*\)\s*=>/,
      transform: 'addToRollupFunction',
    },
    {
      type: 'plugins-array',
      matcher: /plugins\s*:\s*\[/,
      transform: 'addToPluginsArray',
    },
  ],
};
