import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { withZephyr } from 'vite-plugin-zephyr';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: 'wwwroot',
  },
  plugins: [react(), withZephyr()],
});
