import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: 'federation_provider',
      exposes: {
        './button': './src/Button.tsx',
      },
      filename: 'remoteEntry.js', // Without this line it won't work
      shared: ['react', 'react-dom'],
    }),
    withZephyr(),
  ],
  server: {
    port: 3000,
  },
  output: {
    assetPrefix: 'auto', // Without this line it won't work
  },
});
