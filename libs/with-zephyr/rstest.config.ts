import { defineConfig } from '@rstest/core';

export default defineConfig({
  testEnvironment: 'node',
  tools: {
    rspack: {
      experiments: {
        typeReexportsPresence: true,
      },
    },
  },
});
