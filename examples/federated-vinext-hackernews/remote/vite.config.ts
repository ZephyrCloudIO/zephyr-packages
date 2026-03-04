import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'stories_remote',
      filename: 'remoteEntry.js',
      exposes: {
        './Stories': './src/components/Stories',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
      },
    }),
  ],
  server: {
    port: 5174,
    origin: 'http://localhost:5174',
  },
  build: {
    target: 'chrome89',
  },
});
