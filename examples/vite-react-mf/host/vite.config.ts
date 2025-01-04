import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { withZephyr, type ModuleFederationOptions } from 'vite-plugin-zephyr';
// import { federation } from '@module-federation/vite';
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
    // federation({ ...mfConfig }),
    withZephyr({ mfConfig }),
  ],
  build: {
    minify: false,
    target: 'chrome89',
  },
});
