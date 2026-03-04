const path = require('path');
const rspack = require('@rspack/core');
const ReactRefreshPlugin = require('@rspack/plugin-react-refresh');
const { withZephyr } = require('zephyr-rspack-plugin');

const isDev = process.env.NODE_ENV !== 'production';

/** @type {import('@rspack/cli').Configuration} */
module.exports = withZephyr()({
  context: __dirname,
  entry: {
    main: './src/main.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    clean: true,
    publicPath: 'auto',
  },
  experiments: {
    css: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.jsx', '.json'],
  },
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                    development: isDev,
                    refresh: isDev,
                  },
                },
                target: 'es2020',
              },
            },
          },
        ],
      },
      {
        test: /\.css$/,
        type: 'css',
      },
      {
        test: /\.(png|jpe?g|gif|svg|ico)$/i,
        type: 'asset/resource',
      },
    ],
  },
  optimization: {
    runtimeChunk: false,
  },
  plugins: [
    new rspack.container.ModuleFederationPlugin({
      name: 'team_green',
      filename: 'remoteEntry.js',
      exposes: {
        './GreenRecos': './src/app/team-green-recos.tsx',
      },
      shared: {
        react: { singleton: true },
        'react-dom': { singleton: true },
        'react/jsx-runtime': { singleton: true },
        'react/jsx-dev-runtime': { singleton: true },
      },
    }),
    new rspack.HtmlRspackPlugin({ template: './src/index.html' }),
    isDev ? new ReactRefreshPlugin() : null,
  ].filter(Boolean),
  devServer: {
    port: 4400,
    hot: false,
    historyApiFallback: true,
  },
});
