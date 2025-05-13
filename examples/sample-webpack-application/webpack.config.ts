import { composePlugins, withNx } from '@nx/webpack';
import { withReact } from '@nx/react';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import dotenv from 'dotenv';
import type { WebpackPluginInstance } from 'webpack';
const { RawSource } = require('webpack-sources');
import { withZephyr } from 'zephyr-webpack-plugin';

function createInjectRuntimeEnvPlugin(): WebpackPluginInstance {
  return {
    apply(compiler) {
      compiler.hooks.compilation.tap('InjectRuntimeEnvPlugin', (compilation) => {
        HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tapAsync(
          'InjectRuntimeEnvPlugin',
          (data, callback) => {
            data.headTags.push({
              tagName: 'script',
              voidTag: false,
              attributes: {
                src: 'runtime-env.js',
              },
              meta: { plugin: 'InjectRuntimeEnvPlugin' },
            });
            callback(null, data);
          }
        );
      });
    },
  };
}

function createGenerateRuntimeEnvPlugin(): WebpackPluginInstance {
  return {
    apply(compiler) {
      compiler.hooks.thisCompilation.tap('GenerateRuntimeEnvPlugin', (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'GenerateRuntimeEnvPlugin',
            stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONS,
          },
          () => {
            const raw = dotenv.config().parsed || {};
            const safeEnv: Record<string, string> = {};
            for (const [key, value] of Object.entries(raw)) {
              if (key.startsWith('ZE_')) {
                safeEnv[key] = value;
              }
            }
            const content = `window.__ENV__ = ${JSON.stringify(safeEnv, null, 2)};`;
            compilation.emitAsset('runtime-env.js', new RawSource(content));
          }
        );
      });
    },
  };
}

module.exports = composePlugins(
  withNx(),
  withReact(),
  (config) => {
    config.plugins = (config.plugins || []).filter(
      (plugin) => plugin?.constructor?.name !== 'WriteIndexHtmlPlugin'
    );

    config.plugins.push(
      new HtmlWebpackPlugin({ template: './src/index.html' }),
      createInjectRuntimeEnvPlugin(),
      createGenerateRuntimeEnvPlugin()
    );

    return config;
  },
  withZephyr()
);
