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
      format: 'esm',
      syntax: 'es2022',
      output: {
        autoExternal: false,
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
