const reactShared = { singleton: true, requiredVersion: false };

/**
 * @type {ConstructorParameters<
 *   typeof import('@module-federation/enhanced/rspack').ModuleFederationPlugin
 * >[0]}
 */
module.exports = {
  name: 'rspack_nx_mf_remote',
  filename: 'remoteEntry.js',
  exposes: {
    './Module': './src/remote-entry.ts',
  },
  shared: {
    react: reactShared,
    'react-dom': reactShared,
    'react/jsx-runtime': reactShared,
    'react/jsx-dev-runtime': reactShared,
  },
  dts: false,
};
