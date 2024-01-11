const { composePlugins, withNx, withReact } = require('@nx/rspack');
const { withZephyr } = require('@ze/ze-webpack-plugin');

module.exports = composePlugins(
  withNx(),
  withReact(),
  withZephyr(),
  (config) => {
    return config;
  }
);
