const path = require('path');
const rspack = require('@rspack/core');
const { ModuleFederationPlugin } = require('@module-federation/enhanced/rspack');
const { withZephyr } = require('zephyr-rspack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return withZephyr()({
    context: __dirname,
    entry: {
      main: ['./src/main.tsx', './src/styles.css'],
    },
    output: {
      path: path.join(__dirname, 'dist'),
      publicPath: 'auto',
      uniqueName: 'team_green',
      filename: isDev ? '[name].js' : '[name].[contenthash].js',
      chunkFilename: isDev ? '[name].js' : '[name].[contenthash].js',
      clean: true,
    },
    devtool: isDev ? 'source-map' : false,
    devServer: {
      port: 4400,
      historyApiFallback: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    experiments: {
      css: true,
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: { syntax: 'typescript', tsx: true },
                transform: {
                  react: { runtime: 'automatic', development: isDev },
                },
                target: 'es2020',
              },
            },
          },
        },
        {
          test: /\.css$/,
          type: 'css/auto',
        },
        {
          test: /\.(png|jpe?g|gif|webp|svg|ico)$/,
          type: 'asset',
        },
      ],
    },
    plugins: [
      new ModuleFederationPlugin({
        name: 'team_green',
        filename: 'remoteEntry.js',
        exposes: {
          './GreenRecos': './src/app/team-green-recos.tsx',
        },

        shared: {
          react: { singleton: true, requiredVersion: false },
          'react-dom': { singleton: true, requiredVersion: false },
          'react/jsx-runtime': { singleton: true, requiredVersion: false },
          'react/jsx-dev-runtime': { singleton: true, requiredVersion: false },
        },
        dts: false,
      }),
      new rspack.HtmlRspackPlugin({
        template: './src/index.html',
      }),
      new rspack.CopyRspackPlugin({
        patterns: [{ from: 'src/assets', to: '.', noErrorOnMissing: true }],
      }),
    ],
  });
};
