import type { BundlerConfig } from '../types.js';

export const rspressConfig: BundlerConfig = {
  files: ['rspress.config.js', 'rspress.config.ts', 'rspress.config.mjs'],
  plugin: 'zephyr-rspress-plugin',
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
