import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withZephyr, type ModuleFederationOptions } from 'vite-plugin-zephyr';
import { federation } from '@module-federation/vite';
const mfConfig: ModuleFederationOptions = {
  name: 'vite-host',
  filename: 'remoteEntry.js',
  remotes: {
    'vite-remote': {
      name: 'vite-remote',
      entry: 'http://localhost:5174/remoteEntry.js',
      type: 'module',
    },
    vite_webpack: {
      name: 'vite_webpack',
      entry: 'http://localhost:8080/remoteEntry.js',
      type: 'var',
    },
    vite_rspack: {
      name: 'vite_rspack',
      entry: 'http://localhost:8081/remoteEntry.js',
      type: 'var',
    },
  },
  shared: {
    react: {
      singleton: true,
    },
    'react-dom': {
      singleton: true,
    },
  },
};

export default defineConfig({
  plugins: [
    react(),
    // @ts-expect-error type compatibility issue, it will work
    federation({ ...mfConfig }),
    withZephyr(),
  ],
  build: {
    minify: false,
    outDir: '../Agoda.Supply.Finance.WebApi/wwwroot',
    emptyOutDir: false, // to make it stored with webpack
    target: 'esnext',
    manifest: 'asset-manifest-vite.json',
    // minify: true, // To help debug don't remove this
    terserOptions: {
      compress: true,
      mangle: false,
    },
    rollupOptions: {
      output: {
        format: 'esm',
        entryFileNames: `static/js/main.[hash].js`,
        chunkFileNames: `static/js/[name].[hash].js`,
        assetFileNames: ({ name }) => {
          if (name?.indexOf('css') !== -1) return `static/css/[name].[hash].css`;
          else return `static/media/[name].[hash].[ext]`;
        },
        minifyInternalExports: false,
      },
    },
    // federation required
    // target: 'chrome89',
  },
});
