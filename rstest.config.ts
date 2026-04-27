import { defineConfig } from '@rstest/core';

export default defineConfig({
  globals: true,
  passWithNoTests: true,
  setupFiles: ['./rstest.setup.ts'],
  include: [
    'libs/**/*.{test,spec}.{ts,tsx,js,jsx}',
    'examples/**/*.{test,spec}.{ts,tsx,js,jsx}',
    'e2e/**/*.{test,spec}.{ts,tsx,js,jsx}',
  ],
  exclude: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/tmp/**',
  ],
});
