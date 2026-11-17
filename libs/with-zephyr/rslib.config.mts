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
        // Native napi package: its loader must resolve the platform binding from its own
        // install location, which only works when it is not bundled.
        externals: ['@swc-next/parser'],
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
