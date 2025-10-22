import type { BundlerConfig } from '../types.js';

export const rsbuildConfig: BundlerConfig = {
  files: ['rsbuild.config.js', 'rsbuild.config.ts', 'rsbuild.config.mjs'],
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
