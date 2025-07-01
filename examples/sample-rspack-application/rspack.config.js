const { composePlugins, withNx, withReact } = require('@nx/rspack');
const { withZephyr } = require('zephyr-rspack-plugin');

module.exports = composePlugins(withNx(), withReact(), withZephyr(), (config) => {
  return config;
});
