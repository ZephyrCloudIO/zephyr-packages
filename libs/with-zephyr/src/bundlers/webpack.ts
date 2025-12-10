import type { BundlerConfig } from '../types.js';

export const webpackConfig: BundlerConfig = {
  files: ['webpack.config.js', 'webpack.config.ts', 'webpack.config.mjs'],
  plugin: 'zephyr-webpack-plugin',
  importName: 'withZephyr',
  patterns: [
    // Standard webpack config with composePlugins (Nx style)
    {
      type: 'compose-plugins',
      matcher: /composePlugins\s*\(/,
      transform: 'addToComposePlugins',
    },
    // Standard webpack config with plugins array
    {
      type: 'plugins-array',
      matcher: /plugins\s*:\s*\[/,
      transform: 'addToPluginsArray',
    },
    // Module.exports direct assignment
    {
      type: 'module-exports',
      matcher: /module\.exports\s*=/,
      transform: 'wrapModuleExports',
    },
  ],
};
