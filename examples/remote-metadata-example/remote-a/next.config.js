/**
 * Next.js configuration for Remote A application
 * 
 * This configuration demonstrates integration with the Remote Entry Structure Sharing
 * functionality for a Next.js SSR remote application.
 */

const { RemoteStructureSharingIntegration } = require('../../../../remote-entry-structure-sharing-skeleton');

// Mock the ModuleFederationPlugin - in a real application, you would use the actual plugin
class ModuleFederationPlugin {
  constructor(options) {
    this._options = options;
    this.constructor = { name: 'ModuleFederationPlugin' };
  }
  
  apply() {
    // Mock implementation
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Create the Module Federation plugin with exposing components
    const moduleFederationPlugin = new ModuleFederationPlugin({
      name: 'remoteA',
      filename: 'remoteEntry.js',
      exposes: {
        './Component': './src/components/Component.tsx',
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: '^18.2.0',
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^18.2.0',
        },
      },
    });
    
    // Add the Module Federation plugin to the webpack config
    config.plugins.push(moduleFederationPlugin);
    
    // Get package.json
    const packageJson = require('./package.json');
    
    // Add remote metadata publisher
    config = RemoteStructureSharingIntegration.setupBundlerPlugin(
      config,
      packageJson
    );
    
    return config;
  },
};

module.exports = nextConfig;