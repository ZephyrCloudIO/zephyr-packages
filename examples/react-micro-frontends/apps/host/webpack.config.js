const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');
const withModuleFederation = require('@nx/react/module-federation');
const { withZephyr } = require('@ze/ze-webpack-plugin');

const mfConfig = {
  name: 'host',
  remotes: ['team-red'],
  additionalShared: ['react', 'react-dom'],
};

// Nx plugins for webpack.
module.exports = composePlugins(
  withNx(),
  withReact(),
  withZephyr(),
  withModuleFederation(mfConfig),
  (config) => {
    return config;
  }
);
