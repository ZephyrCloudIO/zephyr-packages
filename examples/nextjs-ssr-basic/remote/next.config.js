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
  name: 'nextjs-ssr-basic-remote',
  filename: 'static/chunks/remoteEntry.js',
  exposes: {
    './Button': './src/components/Button',
    './ServerComponent': './src/components/ServerComponent',
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
  remotes: {},
};

module.exports = withFederatedSidecar(federationConfig)(
  withZephyr({
    // Zephyr-specific configuration
    ssrEnabled: true,
    // You can add additional Zephyr configuration here
  })(nextConfig)
);