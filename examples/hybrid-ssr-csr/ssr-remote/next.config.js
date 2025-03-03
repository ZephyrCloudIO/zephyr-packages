const { withFederatedSidecar } = require('@module-federation/nextjs-mf');

const nextConfig = {
  reactStrictMode: true,
  webpack(config, options) {
    const { isServer } = options;
    config.experiments = { layers: true, topLevelAwait: true };
    
    return config;
  }
};

module.exports = withFederatedSidecar({
  name: 'ssrRemote',
  filename: 'static/chunks/remoteEntry.js',
  exposes: {
    './ServerProduct': './src/components/ServerProduct.tsx',
    './ServerCard': './src/components/ServerCard.tsx',
    './ServerHeader': './src/components/ServerHeader.tsx',
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