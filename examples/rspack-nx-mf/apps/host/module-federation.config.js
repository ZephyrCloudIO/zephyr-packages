const reactShared = { singleton: true, requiredVersion: false };

/**
 * @type {ConstructorParameters<
 *   typeof import('@module-federation/enhanced/rspack').ModuleFederationPlugin
 * >[0]}
 */
module.exports = {
  name: 'rspack_nx_mf_host',
  remotes: {
    rspack_nx_mf_remote: 'rspack_nx_mf_remote@http://localhost:4201/remoteEntry.js',
  },
  shared: {
    react: reactShared,
    'react-dom': reactShared,
    'react/jsx-runtime': reactShared,
    'react/jsx-dev-runtime': reactShared,
  },
  dts: false,
};
