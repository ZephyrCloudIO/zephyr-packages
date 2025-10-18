import type { BundlerConfig } from '../types.js';

export const modernjsConfig: BundlerConfig = {
  files: ['modern.config.js', 'modern.config.ts', 'modern.config.mjs'],
  plugin: 'zephyr-modernjs-plugin',
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
