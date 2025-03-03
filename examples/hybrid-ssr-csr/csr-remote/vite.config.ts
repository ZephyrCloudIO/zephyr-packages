import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@module-federation/vite';

export default defineConfig({
  plugins: [
    federation({
      name: 'csrRemote',
      filename: 'remoteEntry.js',
      exposes: {
        './ClientProduct': './src/components/ClientProduct.tsx',
        './ClientCarousel': './src/components/ClientCarousel.tsx',
        './ClientReviews': './src/components/ClientReviews.tsx',
      },
      shared: ['react', 'react-dom']
    }),
    react(),
  ],
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false
  },
  server: {
    port: 5173
  }
});