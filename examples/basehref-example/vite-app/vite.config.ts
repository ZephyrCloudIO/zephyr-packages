import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withZephyr } from 'vite-plugin-zephyr';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/js/',
  plugins: [react(), withZephyr() as any],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
