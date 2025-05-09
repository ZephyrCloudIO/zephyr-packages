import { defineConfig } from 'rolldown';
import { moduleFederationPlugin } from 'rolldown/experimental';
import { withZephyr } from 'zephyr-rolldown-plugin';

export default defineConfig({
  input: './button.jsx',
  output: {
    format: 'esm', // ESM format is required for top-level await
    entryFileNames: '[name].js',
    chunkFileNames: '[name]-[hash].js',
  },
  plugins: [
    // Using the native module federation plugin
    moduleFederationPlugin({
      name: 'rolldown_remote',
      filename: 'remoteEntry.js', // This should match the filename expected by host
      exposes: {
        './button': './button.jsx',
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: '^19.0.0',
        },
      },
      // Skip library config since ESM doesn't use global variables
      manifest: true, // Generate manifest.json for discoverability
      getPublicPath: 'http://localhost:8085/', // Base URL for module loading
    }),

    // Apply Zephyr plugin separately
    withZephyr(),
  ],
});
