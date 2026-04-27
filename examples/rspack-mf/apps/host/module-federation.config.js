module.exports = {
  name: 'rspack_mf_host',
  remotes: {
    rspack_mf_remote: 'rspack_mf_remote@http://localhost:4201/remoteEntry.js',
  },
  shared: {
    react: {
      singleton: true,
      eager: true,
      requiredVersion: '18.3.1',
    },
    'react-dom': {
      singleton: true,
      eager: true,
      requiredVersion: '18.3.1',
    },
    'react/jsx-runtime': {
      singleton: true,
      eager: true,
      requiredVersion: '18.3.1',
    },
    'react/jsx-dev-runtime': {
      singleton: true,
      eager: true,
      requiredVersion: '18.3.1',
    },
  },
};
