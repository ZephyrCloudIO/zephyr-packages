const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('@module-federation/enhanced');
const { RemoteStructureSharingIntegration } = require('../../../../remote-entry-structure-sharing-skeleton');

module.exports = {
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    publicPath: 'http://localhost:3003/'
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              '@babel/preset-env',
              '@babel/preset-react',
              '@babel/preset-typescript'
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'remoteC',
      filename: 'remoteEntry.js',
      exposes: {
        './Card': './src/components/Card.tsx'
      },
      shared: {
        react: { 
          singleton: true, 
          requiredVersion: '^18.2.0' 
        },
        'react-dom': { 
          singleton: true, 
          requiredVersion: '^18.2.0' 
        }
      }
    }),
    new HtmlWebpackPlugin({
      template: './src/index.html',
      filename: 'index.html'
    })
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist')
    },
    port: 3003,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    hot: true
  }
};

// Add Metadata Publishing
const packageJson = require('./package.json');
module.exports = RemoteStructureSharingIntegration.setupBundlerPlugin(
  module.exports,
  packageJson
);