import path from 'node:path';
import { pluginReact } from '@rsbuild/plugin-react';
import { defineConfig } from '@rstest/core';

export default defineConfig({
  globals: true,
  testEnvironment: 'jsdom',
  include: ['src/**/*.{test,spec}.{ts,tsx}'],
  plugins: [pluginReact()],
  resolve: {
    alias: {
      'rspack_nx_mf_remote/Module': path.resolve(
        __dirname,
        'test/remote-module-stub.tsx'
      ),
    },
  },
});
