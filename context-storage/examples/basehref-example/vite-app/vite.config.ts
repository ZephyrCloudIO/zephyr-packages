import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteBaseHrefPlugin } from '../../../basehref-vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteBaseHrefPlugin({
      enabled: true,
      transformHtml: true,
      baseTagOptions: {
        target: '_blank'
      }
    })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});