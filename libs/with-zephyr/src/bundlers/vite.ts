import type { BundlerConfig } from '../types.js';

export const viteConfig: BundlerConfig = {
  files: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.mts'],
  plugin: 'vite-plugin-zephyr',
  importName: 'withZephyr',
  patterns: [
    {
      type: 'define-config-function',
      matcher: /defineConfig\s*\(\s*\(\s*\)\s*=>\s*\(\s*\{/,
      transform: 'addToVitePluginsInFunction',
    },
    {
      type: 'define-config',
      matcher: /defineConfig\s*\(\s*\{/,
      transform: 'addToVitePlugins',
    },
    {
      type: 'export-default',
      matcher: /export\s+default\s+\{/,
      transform: 'addToVitePlugins',
    },
  ],
};
