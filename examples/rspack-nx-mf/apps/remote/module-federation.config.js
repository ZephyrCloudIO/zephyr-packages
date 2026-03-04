module.exports = {
  name: 'rspack_nx_mf_remote',
  exposes: {
    './Module': './src/remote-entry.ts',
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
