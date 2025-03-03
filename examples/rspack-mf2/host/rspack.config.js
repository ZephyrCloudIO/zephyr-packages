const path = require('path');
const { ModuleFederationPlugin } = require('@module-federation/enhanced');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { withZephyr } = require('zephyr-rspack-plugin');

module.exports = {
  entry: './src/index',
  mode: 'development',
  devServer: {
    static: path.join(__dirname, 'dist'),
    port: 3001
  },
  output: {
    publicPath: 'auto'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'builtin:swc-loader',
        exclude: /node_modules/,
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
              jsx: true
            },
            transform: {
              react: {
                runtime: 'automatic'
              }
            }
          }
        }
      },
      {
        test: /\.css$/i,
        type: 'css'
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './public/index.html'
    }),
    // ModuleFederationPlugin from @module-federation/enhanced (MF 2.0)
    withZephyr(new ModuleFederationPlugin({
      name: 'host',
      filename: 'remoteEntry.js',
      remotes: {
        remote: 'remote@http://localhost:3002/remoteEntry.js',
      },
      exposes: {},
      shared: {
        react: {
          singleton: true,
          requiredVersion: '^18.0.0'
        },
        'react-dom': {
          singleton: true,
          requiredVersion: '^18.0.0'
        }
      }
    }))
  ],
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js']
  }
};