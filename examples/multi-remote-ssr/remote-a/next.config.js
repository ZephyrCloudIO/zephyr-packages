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
  name: 'remote_a',
  filename: 'static/chunks/remoteEntry.js',
  exposes: {
    './Header': './src/components/Header',
    './Navigation': './src/components/Navigation',
    './UserProfile': './src/components/UserProfile',
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
    // Remote A might need components from Remote C
    remote_c: {
      url: 'remote_c@http://localhost:3003/_next/static/chunks/remoteEntry.js',
      format: 'var',
      ssrEnabled: true,
    },
  }
};

module.exports = withFederatedSidecar(federationConfig)(
  withZephyr({
    // Zephyr-specific configuration
    ssrEnabled: true,
    remoteName: 'remote_a',
    remoteInfo: {
      type: 'header',
      framework: 'react',
      capabilities: ['ssr', 'theming', 'i18n'],
      dependencies: ['remote_c']
    }
  })(nextConfig)
);