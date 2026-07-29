import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  output: {
    assetPrefix: '/static/',
  },
  plugins: [
    withZephyr(),
    pluginModuleFederation({
      name: 'host',
      remotes: ['header@http://localhost:3001/remoteEntry.js'],
    }),
  ],
});
