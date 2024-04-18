'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
var node_path_1 = require('node:path');
var html_webpack_plugin_1 = require('html-webpack-plugin');
// const {ModuleFederationPlugin} = require('webpack').container;
var zephyr_webpack_plugin_1 = require('zephyr-webpack-plugin');
// const dashboardURL = `${process.env.DASHBOARD_BASE_URL}/env/development/get-remote?token=${process.env.DASHBOARD_READ_TOKEN}`;
var webpackConfig = (0, zephyr_webpack_plugin_1.withZephyr)({
  remotes: ['remote'],
})({
  entry: './src/index',
  mode: 'development',
  devServer: {
    devMiddleware: {
      writeToDisk: true,
    },
    static: {
      directory: (0, node_path_1.join)(__dirname, 'dist'),
    },
    port: 3000,
  },
  output: {
    publicPath: 'auto',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        type: 'javascript/auto',
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(js|ts)x?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
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
    new html_webpack_plugin_1.default({
      template: './public/index.html',
    }),
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
  ],
});
module.exports = webpackConfig;
function ModuleFederationPlugin(params) {}
function clientVersion(params) {}
function FederationDashboardPlugin(param) {}
var dashboardURL = '';
var webpackConfig_vanilla = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    devMiddleware: {
      writeToDisk: true,
    },
    static: {
      directory: (0, node_path_1.join)(__dirname, 'dist'),
    },
    port: 3000,
  },
  output: {
    publicPath: 'auto',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        type: 'javascript/auto',
        resolve: {
          fullySpecified: false,
        },
      },
      {
        test: /\.(js|ts)x?$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [
    // vanilla
    new ModuleFederationPlugin({
      name: 'host',
      filename: 'remoteEntry.js',
      shared: ['react', 'react-dom'],
      exposes: {},
      remotes: {
        app1: 'app1@http://localhost:3001/remoteEntry.js',
        // app1: 'app1@https://staging.app1.com/remoteEntry.js',
        // app1: 'app1@https://app1.com/remoteEntry.js',
        app2: 'app2@http://localhost:3002/remoteEntry.js',
        // app2: 'app2@http://staging.app2.com/remoteEntry.js',
        // app2: 'app2@http://app2.com/remoteEntry.js',
      },
    }),
    // dashboard plugin
    new ModuleFederationPlugin({
      name: 'host',
      filename: 'remoteEntry.js',
      shared: ['react', 'react-dom'],
      exposes: {},
      remotes: {
        app1: clientVersion({
          currentHost: 'home',
          remoteName: 'app1',
          dashboardURL: dashboardURL,
        }),
        app2: clientVersion({
          currentHost: 'home',
          remoteName: 'app2',
          dashboardURL: dashboardURL,
        }),
      },
    }),
    new FederationDashboardPlugin({
      versionStrategy: 'buildHash',
      filename: 'dashboard.json',
      environment: 'development',
      dashboardURL: ''
        .concat(process.env.DASHBOARD_BASE_URL, '/update?token=')
        .concat(process.env.DASHBOARD_WRITE_TOKEN),
      metadata: {
        baseUrl: 'http://localhost:3000',
        source: {
          url: 'https://github.com/ZephyrCloudIO/zephyr-examples/tree/main/examples/react-18/template/host',
        },
        remote: 'http://localhost:3000/remoteEntry.js',
      },
    }),
    // zephyr
    (0, zephyr_webpack_plugin_1.withZephyr)({ remotes: ['app1', 'app2'] }),
    // zephyr v2
    (0, zephyr_webpack_plugin_1.withZephyr)({
      remotes: {
        app1: 'latest',
        app2: '^3.1.0',
      },
    }),
  ],
};
