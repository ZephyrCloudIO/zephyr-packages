import type { BundlerConfig } from '../types.js';

export const viteConfig: BundlerConfig = {
  files: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs', 'vite.config.mts'],
  plugin: 'vite-plugin-zephyr',
  importName: 'withZephyr',
  patterns: [
    // Most specific first: defineConfig with function wrapper
    // Pattern: defineConfig(() => ({ plugins: [...] }))
    {
      type: 'define-config-function',
      matcher: /defineConfig\s*\(\s*\(\s*\)\s*=>\s*\(\s*\{/,
      transform: 'addToVitePluginsInFunction',
    },
    // Standard defineConfig with object
    // Pattern: defineConfig({ plugins: [...] })
    {
      type: 'define-config',
      matcher: /defineConfig\s*\(\s*\{/,
      transform: 'addToVitePlugins',
    },
    // Plain object export (less common)
    // Pattern: export default { plugins: [...] }
    {
      type: 'export-default',
      matcher: /export\s+default\s+\{/,
      transform: 'addToVitePlugins',
    },
  ],
};
