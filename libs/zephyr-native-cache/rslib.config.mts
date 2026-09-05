import { defineConfig } from '@rslib/core';

const entry = ['./src/**', '!./src/**/*.test.ts', '!./src/**/*.spec.ts', '!./src/**/*.d.ts'];

export default defineConfig({
  lib: [
    {
      format: 'cjs',
      syntax: 'es2020',
      bundle: false,
      dts: {
        autoExtension: true,
        distPath: './lib/typescript',
      },
      source: {
        entry: { index: entry },
      },
      output: {
        distPath: {
          root: './lib/commonjs',
        },
        sourceMap: {
          js: 'source-map',
        },
      },
    },
    {
      format: 'esm',
      syntax: 'es2020',
      bundle: false,
      dts: {
        autoExtension: true,
        distPath: './lib/typescript',
      },
      redirect: {
        dts: {
          extension: true,
        },
      },
      source: {
        entry: { index: entry },
      },
      output: {
        distPath: {
          root: './lib/module',
        },
        sourceMap: {
          js: 'source-map',
        },
      },
    },
  ],
});
