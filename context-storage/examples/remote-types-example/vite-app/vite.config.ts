import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteRemoteTypesPlugin } from '../../../remote-types-vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteRemoteTypesPlugin({
      enabled: true,
      logDetectionResults: true,
      outputManifest: true
    })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});