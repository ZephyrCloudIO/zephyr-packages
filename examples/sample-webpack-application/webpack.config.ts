import { composePlugins, withNx } from '@nx/webpack';
import { withReact } from '@nx/react';
import { withZephyr } from 'zephyr-webpack-plugin';

module.exports = composePlugins(
  withNx(),
  withReact(),
  // (config) => {
  //   // config.plugins.push(
  //   //   new HtmlWebpackPlugin({ template: './src/index.html' }),
  //   //   createInjectRuntimeEnvPlugin(),
  //   //   createGenerateRuntimeEnvPlugin()
  //   // );

  //   return config;
  // },
  withZephyr()
);
