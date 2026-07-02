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
        copy: [
          {
            from: './*.md',
            to: '.',
          },
        ],
      },
    },
  ],
});
