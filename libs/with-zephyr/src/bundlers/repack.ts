import type { BundlerConfig } from '../types.js';

export const repackConfig: BundlerConfig = {
  files: ['rspack.config.js', 'rspack.config.ts', 'rspack.config.mjs'],
  plugin: 'zephyr-repack-plugin',
  importName: 'withZephyr',
  patterns: [
    {
      type: 'export-conditional-withzephyr',
      matcher: /export\s+default\s+.*\?\s*withZephyr\s*\(\s*\)\s*\(/,
      transform: 'skipAlreadyWrapped',
    },
    {
      type: 'export-function-variable',
      matcher: /export\s+default\s+(\w+)\s*;?\s*$/,
      transform: 'wrapExportedFunction',
    },
    {
      type: 'const-function-export',
      matcher: /const\s+\w+\s*=\s*\w+\s*=>/,
      transform: 'wrapExportedFunction',
    },
  ],
};
