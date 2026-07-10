import { defineConfig } from '@rslib/core';

export default defineConfig({
  performance: {
    buildCache: false,
  },
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
      syntax: 'es2022',
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
