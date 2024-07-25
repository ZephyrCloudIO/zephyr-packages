import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// import Inspect from 'vite-plugin-inspect';
import { withZephyr } from 'vite-plugin-zephyr';

// https://vitejs.dev/config/
export default defineConfig({
  build: {
    outDir: 'wwwroot',
  },
  plugins: [
    react(),
    //  Inspect({ build: true, outputDir: 'dist/.vite-inspect' }),
    withZephyr(),
  ],
});
