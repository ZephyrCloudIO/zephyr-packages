module.exports = {
  name: 'rspack_nx_mf_host',
  remotes: {
    rspack_nx_mf_remote:
      'rspack_nx_mf_remote@http://localhost:4201/remoteEntry.js',
  },
  shared: {
    react: {
      singleton: true,
      eager: true,
    },
    'react-dom': {
      singleton: true,
      eager: true,
    },
    'react/jsx-runtime': {
      singleton: true,
      eager: true,
    },
    'react/jsx-dev-runtime': {
      singleton: true,
      eager: true,
    },
  },
};
