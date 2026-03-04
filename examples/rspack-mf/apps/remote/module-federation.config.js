module.exports = {
  name: 'rspack_mf_remote',
  exposes: {
    './RemoteWelcome': './src/app/remote-welcome.tsx',
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
