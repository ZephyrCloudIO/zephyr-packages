import { composePlugins, withNx } from '@nx/webpack';

import { withReact } from '@nx/react';

import { withZephyr } from 'zephyr-webpack-plugin';

// Nx plugins for webpack.
module.exports = composePlugins(
  withNx(),
  withReact({}),
  withZephyr(),
  (config) => {
    return config;
  }
);
