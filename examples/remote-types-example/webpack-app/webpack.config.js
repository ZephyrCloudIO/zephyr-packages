const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { webpackRemoteTypesPlugin } = require('../../../remote-types-webpack-plugin');
const { ModuleFederationPlugin } = require('@module-federation/enhanced');

module.exports = (env = {}) => {
  // Determine if SSR mode is enabled
  const isSSR = env.ssr === true;
  
  // Base configuration
  const config = {
    mode: 'development',
    entry: './src/index.tsx',
    output: {
      filename: '[name].[contenthash].js',
      path: path.resolve(__dirname, isSSR ? 'dist-ssr' : 'dist'),
      publicPath: '/',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/,
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
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.jsx']
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        filename: 'index.html',
        inject: 'body'
      }),
      new ModuleFederationPlugin({
        name: 'remoteTypesApp',
        filename: 'remoteEntry.js',
        exposes: {
          './RemoteComponent': './src/RemoteComponent.tsx'
        },
        shared: {
          react: { singleton: true, requiredVersion: '^18.2.0' },
          'react-dom': { singleton: true, requiredVersion: '^18.2.0' }
        }
      }),
      webpackRemoteTypesPlugin({
        // If SSR mode is enabled, explicitly set the render type
        renderType: isSSR ? 'ssr' : undefined,
        outputManifest: true,
        manifestFilename: isSSR ? 'remote-types-ssr-manifest.json' : 'remote-types-manifest.json',
        logDetectionResults: true,
        // Update MF configuration based on detected type
        updateModuleFederationConfig: true
      })
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, 'dist')
      },
      compress: true,
      port: 3000,
      historyApiFallback: true,
      hot: true
    }
  };
  
  // SSR-specific configuration
  if (isSSR) {
    // Set target to node for SSR
    config.target = 'node';
    
    // Update output configuration for SSR
    config.output.libraryTarget = 'commonjs2';
  } else {
    // Set target to web for CSR
    config.target = 'web';
  }
  
  return config;
};