import { defineConfig } from '@rslib/core';

const entry = {
  index: [
    './src/**/*.ts',
    '!./src/**/*.test.ts',
    '!./src/**/*.spec.ts',
    '!./src/**/__test__/**',
    '!./src/**/__tests__/**',
    '!./src/**/__fixtures__/**',
    '!./src/**/*.d.ts',
  ],
};

const output = {
  target: 'node',
  distPath: {
    root: './dist',
  },
  sourceMap: {
    js: 'source-map',
  },
} as const;

export default defineConfig({
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
      shims: {
        esm: {
          __filename: true,
          __dirname: true,
          require: true,
        },
      },
      source: { entry },
      output,
    },
    {
      format: 'cjs',
      syntax: 'es2022',
      bundle: false,
      dts: {
        autoExtension: true,
      },
      source: { entry },
      output,
    },
  ],
});
