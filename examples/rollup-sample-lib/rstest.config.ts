import { pluginReact } from '@rsbuild/plugin-react';
import { defineConfig } from '@rstest/core';

export default defineConfig({
  globals: true,
  testEnvironment: 'jsdom',
  include: ['src/**/*.{test,spec}.{ts,tsx}'],
  plugins: [pluginReact()],
});
