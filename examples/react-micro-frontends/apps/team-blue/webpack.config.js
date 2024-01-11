const { composePlugins, withNx } = require('@nx/webpack');
const { withReact } = require('@nx/react');
const { withModuleFederation } = require('@nx/react/module-federation');
const { withZephyr } = require('@ze/ze-webpack-plugin');

const mfConfig = {
  name: 'team-blue',
  exposes: {
    './BlueBasket': './src/app/team-blue-basket.tsx',
    './BlueBuy': './src/app/team-blue-buy.tsx',
  },
};

// Nx plugins for webpack.
module.exports = composePlugins(
  withNx(),
  withReact(),
  withZephyr(),
  withModuleFederation(mfConfig),
  (config) => {
    return config;
  }
);
