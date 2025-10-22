import type { BundlerConfig } from '../types.js';

export const rolldownConfig: BundlerConfig = {
  files: ['rolldown.config.js', 'rolldown.config.ts', 'rolldown.config.mjs'],
  plugin: 'zephyr-rolldown-plugin',
  importName: 'withZephyr',
  patterns: [
    {
      type: 'define-config',
      matcher: /defineConfig\s*\(\s*\{/,
      transform: 'addToPluginsArrayOrCreate',
    },
    {
      type: 'plugins-array',
      matcher: /plugins\s*:\s*\[/,
      transform: 'addToPluginsArray',
    },
  ],
};
