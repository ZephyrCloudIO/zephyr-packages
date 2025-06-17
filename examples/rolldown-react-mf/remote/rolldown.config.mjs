import { federation } from '@module-federation/vite';
import { defineConfig } from 'rolldown';
import { withZephyr } from 'zephyr-rolldown-plugin';

const mfConfig = {
  name: 'rolldown_mf_remote',
  filename: 'remoteEntry.js',
  exposes: {
    './Button': './src/Button',
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
    federation(mfConfig),
    {
      name: 'emit-html',
      generateBundle() {
        const html = `
          <html>
            <head>
              <title>Rolldown MF Remote</title>
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
