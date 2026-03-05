import type { BundlerConfig } from '../types.js';

export const webpackConfig: BundlerConfig = {
  files: ['webpack.config.js', 'webpack.config.ts', 'webpack.config.mjs'],
  plugin: 'zephyr-webpack-plugin',
  importName: 'withZephyr',
  strategy: 'first-success',
  operations: ['compose-plugins', 'plugins-array', 'wrap-module-exports'],
};
