import { join } from 'node:path';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { Configuration } from 'webpack';
import { Configuration as DevServerConfiguration } from 'webpack-dev-server';
// const {ModuleFederationPlugin} = require('webpack').container;
import { withZephyr } from 'zephyr-webpack-plugin';

// const dashboardURL = `${process.env.DASHBOARD_BASE_URL}/env/development/get-remote?token=${process.env.DASHBOARD_READ_TOKEN}`;

const webpackConfig: Configuration & { devServer: DevServerConfiguration } =
  withZephyr({ remotes: ['remote'] })
  ({
    entry: './src/index',
    mode: 'development',
    devServer: {
      devMiddleware: {
        writeToDisk: true
      },
      static: {
        directory: join(__dirname, 'dist')
      },
      port: 3000
    },
    output: {
      publicPath: 'auto'
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js']
    },
    module: {
      rules: [
        {
          test: /\.m?js$/,
          type: 'javascript/auto',
          resolve: {
            fullySpecified: false
          }
        },
        {
          test: /\.(js|ts)x?$/,
          loader: 'babel-loader',
          exclude: /node_modules/
        }
      ]
    },
    plugins: [
      // new ModuleFederationPlugin({
      // name: 'host',
      // filename: 'remoteEntry.js',
      // shared: ['react', 'react-dom'],
      // shared: require('./package.json').dependencies,
      // exposes: {},

      // remotes: {
      // remote: clientVersion({
      // currentHost: 'home',
      // remoteName: 'remote',
      // dashboardURL
      // })
      // }
      // }),
      new HtmlWebpackPlugin({
        template: './public/index.html'
      })
      // new FederationDashboardPlugin({
      // versionStrategy: 'buildHash',
      // filename: 'dashboard.json',
      // environment: 'development',
      // dashboardURL: `${process.env.DASHBOARD_BASE_URL}/update?token=${process.env.DASHBOARD_WRITE_TOKEN}`,
      // metadata: {
      //   baseUrl: 'http://localhost:3000',
      //   source: {
      //     url: 'https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/examples/react-18/template/host'
      //   },
      //   remote: 'http://localhost:3000/remoteEntry.js'
      // }
      // })
    ]
  });

module.exports = webpackConfig;
