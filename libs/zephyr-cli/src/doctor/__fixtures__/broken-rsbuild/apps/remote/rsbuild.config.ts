import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
import { defineConfig } from '@rsbuild/core';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  plugins: [
    pluginModuleFederation({
      name: 'remote',
      exposes: {
        button: './src/Button.tsx',
      },
    }),
    withZephyr(),
  ],
});
