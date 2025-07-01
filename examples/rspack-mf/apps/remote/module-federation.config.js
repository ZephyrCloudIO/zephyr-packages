const path = require('path');

const currDir = path.resolve(__dirname);

/** @type {Parameters<import('@nx/module-federation/rspack').withModuleFederation>[0]} */
module.exports = {
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
    return false;
  },
};
