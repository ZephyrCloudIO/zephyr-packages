const reactShared = {
  singleton: true,
  version: '18.3.1',
  requiredVersion: '18.3.1',
  eager: true,
};

/**
 * @type {ConstructorParameters<
 *   typeof import('@module-federation/enhanced/rspack').ModuleFederationPlugin
 * >[0]}
 */
module.exports = {
  name: 'rspack_mf_remote',
  filename: 'remoteEntry.js',
  exposes: {
    './NxWelcome': './src/app/nx-welcome.tsx',
  },
  shared: {
    react: reactShared,
    'react-dom': reactShared,
    'react/jsx-runtime': reactShared,
    'react/jsx-dev-runtime': reactShared,
  },
  dts: false,
};
