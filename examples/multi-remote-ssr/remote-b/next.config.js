const { withFederatedSidecar } = require('@module-federation/nextjs-mf');
const { withZephyr } = require('zephyr-webpack-plugin');

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['multi-remote-ssr-shared']
};

const federationConfig = {
  name: 'remote_b',
  filename: 'static/chunks/remoteEntry.js',
  exposes: {
    './ProductCard': './src/components/ProductCard',
    './ProductList': './src/components/ProductList',
    './ContentBlock': './src/components/ContentBlock',
  },
  shared: {
    react: {
      singleton: true,
      requiredVersion: false,
    },
    'react-dom': {
      singleton: true,
      requiredVersion: false,
    },
  },
  remotes: {
    // Remote B might need components from Remote A
    remote_a: {
      url: 'remote_a@http://localhost:3001/_next/static/chunks/remoteEntry.js',
      format: 'var',
      ssrEnabled: true,
    },
  }
};

module.exports = withFederatedSidecar(federationConfig)(
  withZephyr({
    // Zephyr-specific configuration
    ssrEnabled: true,
    remoteName: 'remote_b',
    remoteInfo: {
      type: 'product',
      framework: 'react',
      capabilities: ['ssr', 'lazy-loading', 'data-fetching'],
      dependencies: ['remote_a']
    }
  })(nextConfig)
);