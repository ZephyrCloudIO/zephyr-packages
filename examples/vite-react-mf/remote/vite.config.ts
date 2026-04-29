import react from '@vitejs/plugin-react';
import { federation, type ModuleFederationOptions } from '@module-federation/vite';
import { defineConfig } from 'vite';
import { withZephyr } from 'vite-plugin-zephyr';

const mfConfig: ModuleFederationOptions = {
  name: 'vite-remote',
  filename: 'remoteEntry.js',
  exposes: {
    './Button': './src/Button',
  },
  shared: {
    react: { singleton: true, eager: true },
    'react-dom': { singleton: true, eager: true },
  } as unknown as ModuleFederationOptions['shared'],
  dts: false,
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), federation(mfConfig), withZephyr()],
  experimental: {
    renderBuiltUrl() {
      return { relative: true };
    },
  },
  build: {
    target: 'chrome89',
  },
});
