import { defineConfig } from 'rolldown';
import { moduleFederationPlugin } from 'rolldown/experimental';
import { withZephyr } from 'zephyr-rolldown-plugin';

export default defineConfig({
  input: './button.jsx',
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
        },
      },
      manifest: true, // Generate manifest.json for discoverability
      getPublicPath: 'http://localhost:8085/', // Base URL for module loading
    }),

    // Apply Zephyr plugin separately
    withZephyr(),
  ],
});
