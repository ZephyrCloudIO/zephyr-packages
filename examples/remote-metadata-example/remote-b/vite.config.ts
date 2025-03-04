import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import pkg from './package.json';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    federation({
      name: 'remoteB',
      filename: 'remoteEntry.js',
      exposes: {
        './Button': './src/components/Button.tsx'
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: pkg.dependencies.react
        },
        'react-dom': {
          singleton: true,
          requiredVersion: pkg.dependencies['react-dom']
        }
      }
    }),
    // Custom plugin for metadata publishing
    {
      name: 'metadata-publisher',
      closeBundle: () => {
        // Create metadata from package.json and bundler config
        const metadata = {
          schemaVersion: '1.0.0',
          moduleFederationVersion: '2.0.0',
          renderType: 'csr',  // Explicitly mark as CSR
          framework: 'vite',
          frameworkVersion: pkg.devDependencies.vite,
          dependencies: {
            react: pkg.dependencies.react,
            'react-dom': pkg.dependencies['react-dom']
          },
          exports: {
            './Button': {
              import: './src/components/Button.tsx'
            }
          }
        };

        // Write metadata file alongside remoteEntry.js
        const fs = require('fs');
        const path = require('path');
        const outputPath = 'dist';
        const metadataFilePath = path.join(outputPath, 'remoteEntry.metadata.json');

        if (!fs.existsSync(outputPath)) {
          fs.mkdirSync(outputPath, { recursive: true });
        }

        fs.writeFileSync(metadataFilePath, JSON.stringify(metadata, null, 2));
        console.log('Metadata file created at:', metadataFilePath);
      }
    }
  ],
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false
  },
  server: {
    port: 3002,
    strictPort: true,
    cors: true
  }
});
