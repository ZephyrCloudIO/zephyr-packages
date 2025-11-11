import { composePlugins, withNx } from '@nx/webpack';

import { withReact } from '@nx/react';

import { withZephyr } from 'zephyr-webpack-plugin';

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), withReact({}), withZephyr(), (config) => {
  if (config.plugins) {
    // Remove define plugin if it exists
    config.plugins = config.plugins.filter(
      (plugin) => plugin?.constructor.name !== 'DefinePlugin'
    );
  }

  return config;
});
