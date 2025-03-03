const { NextFederationPlugin } = require('@module-federation/nextjs-mf');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    'multi-remote-ssr-shared'
  ],
  webpack(config, options) {
    // Configure Module Federation
    config.plugins.push(
      new NextFederationPlugin({
        name: 'host',
        filename: 'static/chunks/remoteEntry.js',
        remotes: {
          'remote-a': 'remote-a@http://localhost:3001/_next/static/chunks/remoteEntry.js',
          'remote-b': 'remote-b@http://localhost:3002/_next/static/chunks/remoteEntry.js',
          'remote-c': 'remote-c@http://localhost:3003/_next/static/chunks/remoteEntry.js',
        },
        shared: {
          'react': {
            singleton: true,
            requiredVersion: false,
          },
          'react-dom': {
            singleton: true,
            requiredVersion: false,
          },
          'multi-remote-ssr-shared': {
            singleton: true,
            requiredVersion: false,
          }
        },
        extraOptions: {
          skipSharingNextInternals: true,
          enableImageLoaderFix: true,
          enableUrlLoaderFix: true,
        },
      })
    );

    return config;
  },
};

module.exports = nextConfig;