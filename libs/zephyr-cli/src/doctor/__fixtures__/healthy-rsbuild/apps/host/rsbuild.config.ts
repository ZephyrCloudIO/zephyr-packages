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
      name: 'host',
      remotes: {
        remote: 'remote@http://localhost:3001/mf-manifest.json',
      },
    }),
    withZephyr(),
  ],
});
