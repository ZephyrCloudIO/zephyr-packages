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
  name: 'remote_c',
  filename: 'static/chunks/remoteEntry.js',
  exposes: {
    './Notification': './src/components/Notification',
    './Modal': './src/components/Modal',
    './Loading': './src/components/Loading',
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
  remotes: {}
};

module.exports = withFederatedSidecar(federationConfig)(
  withZephyr({
    // Zephyr-specific configuration
    ssrEnabled: true,
    remoteName: 'remote_c',
    remoteInfo: {
      type: 'utility',
      framework: 'react',
      capabilities: ['ssr', 'animation', 'i18n'],
      dependencies: []
    }
  })(nextConfig)
);