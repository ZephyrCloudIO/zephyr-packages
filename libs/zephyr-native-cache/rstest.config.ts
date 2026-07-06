import { defineConfig } from '@rstest/core';

export default defineConfig({
  globals: true,
  testEnvironment: 'node',
  include: ['__tests__/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.ts'],
});
