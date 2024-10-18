const { composePlugins, withNx, withReact } = require('@nx/rspack');
const { ModuleFederationPlugin } = require('@module-federation/enhanced/rspack');
const { withZephyr } = require('zephyr-webpack-plugin');
const path = require('path');

const withModuleFederation = () => (config) => {
  const currDir = path.resolve(__dirname);
  config.context = currDir;
  config.output.publicPath = 'auto';
  config.plugins.push(
    new ModuleFederationPlugin({
      name: 'rspack_mf_host',
      filename: 'remoteEntry.js',
      remotes: {
        rspack_mf_remote: 'rspack_mf_remote@http://localhost:4201/remoteEntry.js',
      },
      shared: {
        react: {
          singleton: true,
          version: '18.3.1',
          requiredVersion: '18.3.1',
          eager: true,
        },
        'react-dom': {
          singleton: true,
          version: '18.3.1',
          requiredVersion: '18.3.1',
          eager: true,
        },
        'react/jsx-runtime': {
          singleton: true,
          version: '18.3.1',
          requiredVersion: '18.3.1',
          eager: true,
        },
        'react/jsx-dev-runtime': {
          singleton: true,
          version: '18.3.1',
          requiredVersion: '18.3.1',
          eager: true,
        },
      },
    })
  );
  return config;
};

module.exports = composePlugins(withNx(), withReact(), withModuleFederation(), withZephyr());
