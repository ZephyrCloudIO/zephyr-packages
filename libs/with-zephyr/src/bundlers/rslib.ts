import type { BundlerConfig } from '../types.js';

export const rslibConfig: BundlerConfig = {
  files: ['rslib.config.js', 'rslib.config.ts', 'rslib.config.mjs'],
  plugin: 'zephyr-rsbuild-plugin',
  importName: 'withZephyr',
  patterns: [
    {
      type: 'define-config',
      matcher: /defineConfig\s*\(\s*\{/,
      transform: 'addToPluginsArray',
    },
    {
      type: 'plugins-array',
      matcher: /plugins\s*:\s*\[/,
      transform: 'addToPluginsArray',
    },
  ],
};
