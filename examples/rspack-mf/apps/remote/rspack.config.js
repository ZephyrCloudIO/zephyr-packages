const { composePlugins, withNx, withReact } = require('@nx/rspack');
const { withModuleFederation } = require('@nx/module-federation/rspack');
const { withZephyr } = require('zephyr-rspack-plugin');
const mfConfig = require('./module-federation.config');

module.exports = composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(mfConfig, { dts: false }),
  withZephyr()
);
