import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { withZephyr } from 'zephyr-vite-plugin';

export default defineConfig({
  plugins: [
    react(),
    withZephyr(federation({
      name: 'remote',
      filename: 'remoteEntry.js',
      remotes: {},
      exposes: {
        './Button': './src/components/Button.tsx'
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: '^18.0.0'
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^18.0.0'
        }
      }
    }))
  ],
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'esm',
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    }
  },
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  server: {
    port: 4002
  },
  preview: {
    port: 4002
  }
});