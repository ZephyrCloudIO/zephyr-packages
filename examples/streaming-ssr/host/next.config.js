const { withFederatedSidecar } = require('@module-federation/nextjs-mf');

const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Enable React 18 streaming features
    ppr: true, // Parallel Routes and Intercepting Routes
    serverActions: { bodySizeLimit: '2mb' }, // Enable server actions
  },
  webpack(config, options) {
    const { isServer } = options;
    config.experiments = { 
      layers: true, 
      topLevelAwait: true 
    };
    
    return config;
  }
};

module.exports = withFederatedSidecar({
  name: 'host',
  filename: 'static/chunks/remoteEntry.js',
  exposes: {},
  remotes: {
    remote: `remote@http://localhost:3001/_next/static/chunks/remoteEntry.js`,
    shell: `shell@http://localhost:3002/_next/static/chunks/remoteEntry.js`,
  },
  shared: {
    react: {
      requiredVersion: false,
      singleton: true,
    },
    'react-dom': {
      requiredVersion: false,
      singleton: true,
    },
  }
})(nextConfig);