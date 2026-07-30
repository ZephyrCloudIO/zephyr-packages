import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  source: {
    entry: {
      main: './src/index.ts',
    },
  },
  output: {
    assetPrefix: 'auto',
  },
  plugins: [
    pluginModuleFederation({
      name: 'remote',
      filename: 'remoteEntry.js',
      exposes: {
        './button': './src/Button.tsx',
      },
    }),
    withZephyr(),
  ],
});
