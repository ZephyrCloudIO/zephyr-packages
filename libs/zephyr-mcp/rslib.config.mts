import { defineConfig } from '@rslib/core';

// Pure ESM, bundleless: each entry point loads only the modules it uses, so
// the Worker-safe entries (., ./manifest, ./worker) never pull in node:*.
export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'es2022',
      bundle: false,
      dts: true,
      source: {
        entry: {
          index: ['./src/**', '!./src/**/*.spec.ts', '!./src/**/*.test.ts'],
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
