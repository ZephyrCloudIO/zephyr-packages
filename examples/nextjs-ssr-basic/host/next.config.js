const { withFederatedSidecar } = require('@module-federation/nextjs-mf');
const { withZephyr } = require('zephyr-webpack-plugin');

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['nextjs-ssr-basic-shared']
};

const federationConfig = {
  name: 'nextjs-ssr-basic-host',
  filename: 'static/chunks/remoteEntry.js',
  remotes: {
    remote: {
      url: 'nextjs-ssr-basic-remote@http://localhost:3001/_next/static/chunks/remoteEntry.js',
      format: 'var',
      // Zephyr-specific configuration
      ssrEnabled: true,
      version: '0.1.0',
      fallbacks: [
        'http://localhost:3001/_next/static/chunks/remoteEntry.js',
        './remote-fallback/remoteEntry.js'
      ]
    }
  },
  exposes: {},
  shared: {
    react: {
      singleton: true,
      requiredVersion: false,
    },
    'react-dom': {
      singleton: true,
      requiredVersion: false,
    },
  }
};

module.exports = withFederatedSidecar(federationConfig)(
  withZephyr({
    // Zephyr-specific configuration
    ssrEnabled: true,
    // You can add additional Zephyr configuration here
  })(nextConfig)
);