const { composePlugins, withNx, withReact } = require('@nx/rspack');
const path = require('path');
const { ModuleFederationPlugin } = require('@module-federation/enhanced/rspack');
const { withZephyr } = require('zephyr-rspack-plugin');

const withModuleFederation = () => (config) => {
  const currDir = path.resolve(__dirname);
  config.output.publicPath = 'auto';
  config.plugins.push(
    new ModuleFederationPlugin({
      name: 'rspack_mf_remote',
      filename: 'remoteEntry.js',
      exposes: {
        './NxWelcome': currDir + '/src/app/nx-welcome.tsx',
      },
    })
  );
  config.context = currDir;
  return config;
};

module.exports = composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(),
  withZephyr()
);
