import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { withZephyr } from 'zephyr-rspack-plugin';

export default defineConfig({
  plugins: [pluginReact(), withZephyr()],
});
