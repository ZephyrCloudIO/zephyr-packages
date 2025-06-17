import { defineConfig } from 'rolldown';
import { withZephyr } from 'zephyr-rolldown-plugin';

const mfConfig = {
  name: 'rolldown_mf_host',
  filename: 'remoteEntry.js',
  remotes: {
    rolldown_mf_remote: {
      name: 'rolldown_mf_remote',
      entry: 'http://localhost:3001/remoteEntry.js',
      type: 'module',
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
  input: 'src/main.tsx',
  plugins: [
    {
      name: 'emit-html',
      generateBundle() {
        const html = `
          <html>
            <head>
              <title>Rolldown MF Host</title>
            </head>
            <body>
              <div id="root"></div>
              <script type="module" src="./main.js"></script>
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
    withZephyr({ mfConfig }),
  ],
});
