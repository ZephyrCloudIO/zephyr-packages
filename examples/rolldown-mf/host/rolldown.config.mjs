import { defineConfig } from 'rolldown';
import { moduleFederationPlugin } from 'rolldown/experimental';
import { withZephyr } from 'zephyr-rolldown-plugin';

export default defineConfig({
  input: './index.jsx',
  plugins: [
    // Using the native module federation plugin with explicit remote entry
    moduleFederationPlugin({
      name: 'rolldown_host',
      remotes: {
        rolldown: 'rolldown_remote@http://localhost:8085/remoteEntry.js',
      },
      shared: {
        react: {
          singleton: true,
        },
      },
    }),

    // Apply Zephyr plugin with enhanced manifest URL handling
    withZephyr({
      verbose: true,
    }),

    // HTML generation
    {
      name: 'emit-html',
      generateBundle() {
        const html = `
          <html>
            <head>
              <!-- The runtime patch will be injected here -->
            </head>
            <body>
              <div id="app"></div>
              <script type="module" src="./index.js"></script>
            </body>
          </html>
        `;
        this.emitFile({
          type: 'asset',
          fileName: 'index.html',
          source: html,
        });
      },
    },
  ],
});
