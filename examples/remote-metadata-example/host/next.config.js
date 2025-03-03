/**
 * Next.js configuration for Host application
 * 
 * This configuration demonstrates integration with the Remote Entry Structure Sharing
 * functionality for a host application that consumes multiple remotes.
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
    // Create the Module Federation plugin with remotes
    const moduleFederationPlugin = new ModuleFederationPlugin({
      name: 'host',
      remotes: {
        remoteA: 'remoteA@http://localhost:3001/remoteEntry.js',
        remoteB: 'remoteB@http://localhost:3002/remoteEntry.js',
        remoteC: 'remoteC@http://localhost:3003/remoteEntry.js',
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
    
    // Add remote metadata consumer
    config = RemoteStructureSharingIntegration.setupConsumerPlugin(config);
    
    return config;
  },
};

module.exports = nextConfig;