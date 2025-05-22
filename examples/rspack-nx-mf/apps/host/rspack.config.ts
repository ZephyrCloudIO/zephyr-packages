import {
  NxModuleFederationDevServerPlugin,
  NxModuleFederationPlugin,
} from '@nx/module-federation/rspack';
import { NxAppRspackPlugin } from '@nx/rspack/app-plugin';
import { NxReactRspackPlugin } from '@nx/rspack/react-plugin';
import { join } from 'path';

import { withZephyr } from 'zephyr-rspack-plugin';
import config from './module-federation.config';

const rspackConfig = {
  output: {
    path: join(__dirname, '../../../../dist/examples/rspack-nx-mf/apps/host'),
    publicPath: 'auto',
  },
  devServer: {
    port: 4200,
    historyApiFallback: true,
  },
  plugins: [
    new NxAppRspackPlugin({
      tsConfig: './tsconfig.app.json',
      main: './src/main.ts',
      index: './src/index.html',
      baseHref: '/',
      assets: ['./src/favicon.ico', './src/assets'],
      styles: ['./src/styles.css'],
      outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
      optimization: process.env['NODE_ENV'] === 'production',
    }),
    new NxReactRspackPlugin({
      // Uncomment this line if you don't want to use SVGR
      // See: https://react-svgr.com/
      // svgr: false
    }),
    new NxModuleFederationPlugin({ config }, { dts: false }),
    new NxModuleFederationDevServerPlugin({ config }),
  ],
};

export default withZephyr()(rspackConfig);
// export default rspackConfig;
