import { defineConfig } from 'rolldown';
import { moduleFederationPlugin } from 'rolldown/experimental';
import { withZephyr } from 'zephyr-rolldown-plugin';

// TODO: can't resolve `./Button.jsx` at ubuntu.
export default defineConfig({
  input: './button.jsx',
  plugins: [
    moduleFederationPlugin({
      name: 'rolldown-remote',
      filename: 'remote-entry.js',
      exposes: {
        './button': './button.jsx',
      },
      shared: {
        react: {
          singleton: true,
        },
      },
      manifest: true,
      getPublicPath: 'http://localhost:8085/',
    }),
    withZephyr(),
  ],
});
