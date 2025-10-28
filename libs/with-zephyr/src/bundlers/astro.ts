import type { BundlerConfig } from '../types.js';

export const astroConfig: BundlerConfig = {
  files: ['astro.config.js', 'astro.config.ts', 'astro.config.mjs', 'astro.config.mts'],
  plugin: 'zephyr-astro-integration',
  importName: 'withZephyr',
  patterns: [
    // Most specific first: defineConfig with function wrapper
    // Pattern: defineConfig(() => ({ integrations: [...] }))
    {
      type: 'define-config-function',
      matcher: /defineConfig\s*\(\s*\(\s*\)\s*=>\s*\(\s*\{/,
      transform: 'addToAstroIntegrationsInFunction',
    },
    // Standard defineConfig with object
    // Pattern: defineConfig({ integrations: [...] })
    {
      type: 'define-config',
      matcher: /defineConfig\s*\(\s*\{/,
      transform: 'addToAstroIntegrations',
    },
    // Plain object export (less common)
    // Pattern: export default { integrations: [...] }
    {
      type: 'export-default',
      matcher: /export\s+default\s+\{/,
      transform: 'addToAstroIntegrations',
    },
  ],
};
