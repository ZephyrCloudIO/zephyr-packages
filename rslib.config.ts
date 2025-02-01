import { defineConfig } from '@rslib/core';

export default defineConfig({
  source: {
    entry: {
      index: './package/index.ts',
    },
  },
  lib: [
    {
      format: 'cjs',
      autoExtension: false,
      syntax: 'es2020',
      dts: {
        build: true,
      },
      output: {
        target: 'node',
        filename: {
          js: '[name].cjs',
        },
        cleanDistPath: true,
      },
    },
    {
      format: 'esm',
      autoExtension: false,
      syntax: 'es2020',
      dts: {
        build: true,
      },
      output: {
        target: 'node',
        filename: {
          js: '[name].mjs',
        },
        cleanDistPath: true,
      },
    },
  ],
});
