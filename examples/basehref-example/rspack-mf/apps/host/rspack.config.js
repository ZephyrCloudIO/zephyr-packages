const { composePlugins, withNx, withReact } = require('@nx/rspack');
const { withModuleFederation } = require('@nx/module-federation/rspack');
const { withZephyr } = require('zephyr-rspack-plugin');

/** @type {Parameters<typeof withModuleFederation>[0]} */
const mfConfig = {
  name: 'rspack_mf_host',
  remotes: ['rspack_mf_remote'],
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
  withNx({ baseHref: publicPath}),
  withReact(),
  withModuleFederation(mfConfig),
  withZephyr()
);
