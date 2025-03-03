import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteRemoteTypesPlugin } from '../../../remote-types-vite-plugin';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteRemoteTypesPlugin({
      enabled: true,
      renderType: 'ssr', // Explicitly set to SSR
      logDetectionResults: true,
      outputManifest: true,
      manifestFilename: 'remote-types-ssr-manifest.json'
    })
  ],
  build: {
    ssr: true, // Enable SSR build
    outDir: 'dist-ssr'
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});