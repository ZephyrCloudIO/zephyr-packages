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
  name: 'remote',
  filename: 'static/chunks/remoteEntry.js',
  exposes: {
    './ProductStream': './src/components/ProductStream.tsx',
    './CommentsStream': './src/components/CommentsStream.tsx',
    './RecommendationsStream': './src/components/RecommendationsStream.tsx',
    './ProfileStream': './src/components/ProfileStream.tsx',
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