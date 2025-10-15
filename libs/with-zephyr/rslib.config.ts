import { defineConfig } from '@rslib/core';
import { withZephyr } from 'zephyr-rsbuild-plugin';

export default defineConfig({
  plugins: [withZephyr()],
  source: {
    entry: {
      index: 'src/index.ts',
    },
  },
  lib: [
    {
      autoExternal: false,
      format: 'esm',
      output: {
        distPath: {
          root: 'dist',
        },
      },
    },
  ],
});
