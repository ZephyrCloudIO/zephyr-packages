const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { withZephyr } = require('zephyr-webpack-plugin');

module.exports = (env, argv) => {
  const isDev = argv.mode === 'development';

  return withZephyr()({
    context: __dirname,
    entry: {
      main: ['./src/main.tsx', './src/styles.css'],
    },
    output: {
      path: path.join(__dirname, 'dist'),
      publicPath: '/',
      filename: isDev ? '[name].js' : '[name].[contenthash].js',
      chunkFilename: isDev ? '[name].js' : '[name].[contenthash].js',
      clean: true,
    },
    devtool: isDev ? 'source-map' : false,
    devServer: {
      port: 4200,
      historyApiFallback: true,
      hot: true,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'swc-loader',
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
          test: /\.module\.css$/,
          use: ['style-loader', { loader: 'css-loader', options: { modules: true } }],
        },
        {
          test: /\.css$/,
          exclude: /\.module\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|webp|svg|ico)$/,
          type: 'asset',
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        favicon: './src/favicon.ico',
      }),
    ],
  });
};
