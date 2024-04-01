import { composePlugins, withNx, withReact } from '@nx/rspack';
import { withZephyr } from 'zephyr-webpack-plugin';

const config = composePlugins(withNx(), withReact(), withZephyr(), (config) => {
  return config;
});

export = config;
