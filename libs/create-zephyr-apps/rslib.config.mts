import { defineConfig } from '@rslib/core';

export default defineConfig({
  performance: {
    buildCache: false,
  },
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      bundle: false,
      dts: true,
      source: {
        entry: {
          index: [
            './src/**/*.ts',
            '!./src/**/*.test.ts',
            '!./src/**/*.spec.ts',
            '!./src/**/__test__/**',
            '!./src/**/__tests__/**',
            '!./src/**/__fixtures__/**',
            '!./src/**/*.d.ts',
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
