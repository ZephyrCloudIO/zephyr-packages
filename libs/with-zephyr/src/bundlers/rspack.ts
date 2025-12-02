import type { BundlerConfig } from '../types.js';

export const rspackConfig: BundlerConfig = {
  files: ['rspack.config.js', 'rspack.config.ts', 'rspack.config.mjs'],
  plugin: 'zephyr-rspack-plugin',
  importName: 'withZephyr',
  patterns: [
    // IMPORTANT: Skip pattern must be first to avoid double-wrapping
    // Detects configs already wrapped with withZephyr()
    {
      type: 'export-wrapped-call',
      matcher: /export\s+default\s+withZephyr\s*\(\s*\)\s*\(/,
      transform: 'skipAlreadyWrapped',
    },
    // defineConfig wrapper (native rspack)
    {
      type: 'define-config',
      matcher: /export\s+default\s+defineConfig\s*\(/,
      transform: 'wrapExportDefault',
    },
    // Nx-style composePlugins - inject withZephyr into plugin composition
    {
      type: 'compose-plugins',
      matcher: /composePlugins\s*\(/,
      transform: 'addToComposePlugins',
    },
    // Plain object export - wrap entire config
    {
      type: 'export-default-object',
      matcher: /export\s+default\s+\{/,
      transform: 'wrapExportDefault',
    },
    // Standard plugins array - add to existing plugins
    {
      type: 'plugins-array',
      matcher: /plugins\s*:\s*\[/,
      transform: 'addToPluginsArray',
    },
    // CommonJS module.exports - wrap entire config
    {
      type: 'module-exports',
      matcher: /module\.exports\s*=/,
      transform: 'wrapModuleExports',
    },
  ],
};
