
import type { WebpackPluginInstance } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';

// A Webpack plugin to inject `runtime-env.js` into the HTML `<head>` using `html-webpack-plugin`.
export const insertRuntimeEnvPlugin = (): WebpackPluginInstance => ({
  apply(compiler) {
    compiler.hooks.compilation.tap('InjectRuntimeEnvPlugin', (compilation) => {
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tapAsync(
        'InjectRuntimeEnvPlugin',
        (data, callback) => {
          data.headTags.push({
            tagName: 'script',
            voidTag: false,
            attributes: { src: 'runtime-env.js' },
          });
          callback(null, data);
        }
      );
    });
  },
});
