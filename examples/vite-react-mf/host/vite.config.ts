import react from '@vitejs/plugin-react';
import { federation, type ModuleFederationOptions } from '@module-federation/vite';
import { defineConfig } from 'vite';
import { withZephyr } from 'vite-plugin-zephyr';

const mfConfig: ModuleFederationOptions = {
  name: 'vite-host',
  filename: 'remoteEntry.js',
  remotes: {
    vite_remote: {
      name: 'vite_remote',
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
  dts: false,
};

export default defineConfig({
  plugins: [react(), federation(mfConfig), withZephyr()],
  build: {
    target: 'chrome89',
  },
});
