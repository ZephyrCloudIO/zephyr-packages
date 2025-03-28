const { composePlugins, withNx, withReact } = require('@nx/rspack');
const path = require('path');
const { withModuleFederation } = require('@nx/module-federation/rspack');
const { withZephyr } = require('zephyr-rspack-plugin');

const currDir = path.resolve(__dirname);

/** @type {Parameters<typeof withModuleFederation>[0]} */
const mfConfig = {
  name: 'rspack_mf_remote',
  exposes: {
    './NxWelcome': currDir + '/src/app/nx-welcome.tsx',
  },
  shared: (libName) => {
    const reactShared = [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'react/jsx-dev-runtime',
    ];
    if (reactShared.includes(libName)) {
      return {
        singleton: true,
        version: '18.3.1',
        requiredVersion: '18.3.1',
        eager: true,
      };
    }
  },
};

module.exports = composePlugins(
  withNx(),
  withReact(),
  withModuleFederation(mfConfig),
  withZephyr()
);
