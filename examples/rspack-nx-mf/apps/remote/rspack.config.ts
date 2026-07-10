import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import { CopyRspackPlugin, HtmlRspackPlugin, type Configuration } from '@rspack/core';
import { withZephyr } from 'zephyr-rspack-plugin';
import mfConfig from './module-federation.config.ts';

type RspackConfig = (
  env: Record<string, unknown>,
  argv: { mode?: Configuration['mode'] }
) => Promise<Configuration>;

const configDirectory = dirname(fileURLToPath(import.meta.url));

const config: RspackConfig = (_env, argv) => {
  const isDev = argv.mode === 'development';

  return withZephyr()({
    context: configDirectory,
    entry: {
      main: './src/main.ts',
    },
    output: {
      path: join(configDirectory, 'dist'),
      publicPath: 'auto',
      uniqueName: mfConfig.name,
      filename: isDev ? '[name].js' : '[name].[contenthash].js',
      chunkFilename: isDev ? '[name].js' : '[name].[contenthash].js',
      clean: true,
    },
    devtool: isDev ? 'source-map' : false,
    devServer: {
      port: 4201,
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
      new ModuleFederationPlugin(mfConfig),
      new HtmlRspackPlugin({
        template: './src/index.html',
      }),
      new CopyRspackPlugin({
        patterns: [
          { from: 'src/favicon.ico', to: '.' },
          { from: 'src/assets', to: 'assets', noErrorOnMissing: true },
        ],
      }),
    ],
  });
};

export default config;
