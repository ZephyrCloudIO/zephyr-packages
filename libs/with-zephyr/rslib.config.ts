import { defineConfig } from '@rslib/core';

export default defineConfig({
  // plugins: [withZephyr()],
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
  tools: {
    rspack: {
      experiments: {
        typeReexportsPresence: true,
      },
    },
  },
});
