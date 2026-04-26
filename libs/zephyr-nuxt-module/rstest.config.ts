import { defineConfig } from '@rstest/core';

export default defineConfig({
  globals: true,
  testEnvironment: 'node',
  passWithNoTests: true,
  setupFiles: ['../../rstest.setup.ts'],
  coverage: {
    enabled: false,
    provider: 'istanbul',
    reportsDirectory: '../../coverage/libs/zephyr-nuxt-module',
  },
});
