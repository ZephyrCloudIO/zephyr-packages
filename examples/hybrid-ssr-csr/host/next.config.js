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
  name: 'host',
  filename: 'static/chunks/remoteEntry.js',
  exposes: {},
  remotes: {
    ssrRemote: `ssrRemote@http://localhost:3001/_next/static/chunks/remoteEntry.js`,
    csrRemote: `csrRemote@http://localhost:5173/assets/remoteEntry.js`,
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