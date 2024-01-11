const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');

const { withZephyr } = require('@ze/ze-webpack-plugin');

// Nx plugins for webpack.
module.exports = composePlugins(
  withNx(),
  withReact({}),
  withZephyr(),
  (config) => {
    return config;
  }
);
