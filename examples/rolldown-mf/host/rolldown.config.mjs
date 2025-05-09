import { defineConfig } from 'rolldown';
import { moduleFederationPlugin } from 'rolldown/experimental';
import { withZephyr } from 'zephyr-rolldown-plugin';

export default defineConfig({
  input: './index.jsx',
  output: {
    format: 'esm', // ESM format is required for top-level await support
    entryFileNames: '[name].js',
    chunkFileNames: '[name]-[hash].js',
  },
  plugins: [
    // Using the native module federation plugin with explicit remote entry
    moduleFederationPlugin({
      name: 'rolldown_host',
      remotes: [
        {
          name: 'rolldown',
          entry: 'http://localhost:8085/remoteEntry.js',
          entryGlobalName: 'rolldown_remote'
        }
      ],
      shared: {
        react: {
          singleton: true,
          requiredVersion: '^19.0.0',
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
        const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rolldown Module Federation Host</title>
    <!-- Initialize remote globals -->
    <script src="./fix-mf.js"></script>
  </head>
  <body>
    <div id="app"></div>
    <!-- Use type="module" for ESM support -->
    <script type="module" src="./index.js"></script>
  </body>
</html>
        `;
        this.emitFile({
          type: 'asset',
          fileName: 'index.html',
          source: html,
        });

        // Copy the fix-mf.js to the output directory
        this.emitFile({
          type: 'asset',
          fileName: 'fix-mf.js',
          source: `// Helper script for module federation with ESM compatibility
const remoteName = 'rolldown_remote';
console.log('Setting up Module Federation helper');

// Create a properly structured container object for rolldown_remote
window.rolldown_remote = window.rolldown_remote || {
  get: async function(module) {
    try {
      console.log('Requesting module:', module);
      // Dynamically import the remote entry first
      const remoteEntry = await import('https://nestor-lopez-1347-rolldown-remote-zephyr-packages-c21a1eda7-ze.zephyr-cloud.io/remoteEntry.js');
      // Then use its get method to load the requested module
      if (typeof remoteEntry.get === 'function') {
        return remoteEntry.get(module);
      } else {
        console.error('Remote entry does not provide a get() function', remoteEntry);
        throw new Error('Remote entry missing get() function');
      }
    } catch (e) {
      console.error('Error loading module:', module, e);
      throw e;
    }
  },
  init: async function(shared) {
    try {
      // Dynamically import the remote entry
      const remoteEntry = await import('https://nestor-lopez-1347-rolldown-remote-zephyr-packages-c21a1eda7-ze.zephyr-cloud.io/remoteEntry.js');
      // Initialize the container
      if (typeof remoteEntry.init === 'function') {
        return remoteEntry.init(shared);
      } else {
        console.warn('Remote entry does not provide an init() function', remoteEntry);
      }
    } catch (e) {
      console.error('Error initializing remote container:', e);
      throw e;
    }
  }
};

// Debug helper
console.log('Available remotes at window:',
  Object.keys(window).filter(key => key.includes('remote') || key.includes('rolldown')));
`
        });
      },
    },
  ],
});
