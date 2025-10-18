import type { BundlerConfig } from '../types.js';

export const rspackConfig: BundlerConfig = {
  files: ['rspack.config.js', 'rspack.config.ts', 'rspack.config.mjs'],
  plugin: 'zephyr-rspack-plugin',
  importName: 'withZephyr',
  patterns: [
    {
      type: 'export-wrapped-call',
      matcher: /export\s+default\s+withZephyr\s*\(\s*\)\s*\(/,
      transform: 'skipAlreadyWrapped',
    },
    {
      type: 'compose-plugins',
      matcher: /composePlugins\s*\(/,
      transform: 'addToComposePlugins',
    },
    {
      type: 'export-default-object',
      matcher: /export\s+default\s+\{/,
      transform: 'wrapExportDefault',
    },
    {
      type: 'plugins-array',
      matcher: /plugins\s*:\s*\[/,
      transform: 'addToPluginsArray',
    },
    {
      type: 'module-exports',
      matcher: /module\.exports\s*=/,
      transform: 'wrapModuleExports',
    },
  ],
};
