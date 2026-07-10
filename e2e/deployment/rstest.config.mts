import { defineConfig } from '@rstest/core';

export default defineConfig({
  globals: false,
  root: import.meta.dirname,
  include: ['src/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
  source: {
    tsconfigPath: './tsconfig.json',
  },
  testEnvironment: 'node',
  testTimeout: 360_000,
});
