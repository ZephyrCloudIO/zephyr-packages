import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'module',
    commonjsOptions: {
      include: './src/index.ts',
    },
  },
});
