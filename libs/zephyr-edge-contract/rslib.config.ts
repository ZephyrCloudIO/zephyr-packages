import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      format: 'cjs',
      syntax: 'es2017',
      bundle: false,
      dts: true,
      source: {
        entry: {
          index: [
            './src/**',
            '!./src/**/*.test.ts',
            '!./src/**/*.spec.ts',
            '!./src/**/__test__/**',
            '!./src/**/__tests__/**',
          ],
        },
      },
      output: {
        target: 'node',
        distPath: {
          root: './dist',
        },
        sourceMap: {
          js: 'source-map',
        },
      },
    },
  ],
});
