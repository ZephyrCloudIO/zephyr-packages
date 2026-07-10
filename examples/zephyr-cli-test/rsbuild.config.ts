import { defineConfig } from '@rsbuild/core';
import { withZephyr } from 'zephyr-rsbuild-plugin';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact(), withZephyr()],
  output: { assetPrefix: 'auto' },
});
