import { defineConfig } from '@rslib/core';

const entry = {
  index: [
    './src/**',
    '!./src/**/*.test.ts',
    '!./src/**/*.spec.ts',
    '!./src/**/__test__/**',
    '!./src/**/__tests__/**',
  ],
};

export default defineConfig({
  performance: {
    buildCache: false,
  },
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      bundle: false,
      dts: {
        autoExtension: true,
      },
      redirect: {
        dts: {
          extension: true,
        },
      },
      source: {
        entry,
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
    {
      format: 'cjs',
      syntax: 'es2022',
      bundle: false,
      dts: {
        autoExtension: true,
      },
      source: {
        entry,
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
