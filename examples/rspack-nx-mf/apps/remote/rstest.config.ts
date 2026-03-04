import { defineConfig } from '@rstest/core';

export default defineConfig({
  globals: true,
  testEnvironment: 'jsdom',
  passWithNoTests: true,
  setupFiles: ['../../../../rstest.setup.ts'],
  tools: {
    swc: {
      jsc: {
        parser: { syntax: "typescript", tsx: true },
        transform: { react: { runtime: "automatic" } },
      },
    },
  },
  coverage: {
    enabled: false,
    provider: "istanbul",
    reportsDirectory: '../../../../coverage/examples/rspack-nx-mf/apps/remote',
  },
});
