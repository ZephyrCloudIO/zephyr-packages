import { type ZeEnvVarsPluginOptions } from 'zephyr-xpack-internal';
import type { Compiler } from 'webpack';
import { ze_log, createTemporaryVariablesFile } from 'zephyr-agent';
import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const PLUGIN_NAME = 'ZeEnvVarsWebpackPlugin';

// Global set to collect environment variables across all modules
const GLOBAL_ENV_VARS = new Set<string>();

export class ZeEnvVarsWebpackPlugin {
  private publicPath = '';
  private assetFilename = '';
  private assetSource = '';
  private varsMap: Record<string, string> = {};

  constructor(private options: ZeEnvVarsPluginOptions = {}) {}

  apply(compiler: Compiler): void {
    const { RawSource } = compiler.webpack.sources;

    // Register loader for JS/TS
    const loaderPath = path.resolve(__dirname, './ze-env-vars-webpack-loader.js');
    const rules = compiler.options.module?.rules || [];
    rules.push({
      test: /\.(js|jsx|ts|tsx)$/,
      use: [loaderPath],
      enforce: 'pre',
    });
    compiler.options.module = compiler.options.module || {};
    compiler.options.module.rules = rules;

    ze_log(`${PLUGIN_NAME}: Added environment variables loader to webpack rules`);

    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      ze_log(`${PLUGIN_NAME}: Plugin initialized`);

      // Attach env vars set to loader context
      compilation.hooks.normalModuleLoader.tap(PLUGIN_NAME, (loaderContext) => {
        //@ts-expect-error
        loaderContext.zeEnvVars = GLOBAL_ENV_VARS;
      });

      // Generate the environment variables asset
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        },
        (assets) => {
          if (GLOBAL_ENV_VARS.size === 0) {
            ze_log(
              `${PLUGIN_NAME}: No environment variables detected, skipping asset generation`
            );
            return;
          }

          const { source, hash, varsMap } = createTemporaryVariablesFile(GLOBAL_ENV_VARS);
          this.assetFilename = `ze-envs-${hash}.js`;
          this.assetSource = source;
          this.varsMap = varsMap;

          this.publicPath = (compiler.options.output?.publicPath as string) || '';
          if (this.publicPath === 'auto') this.publicPath = '';

          // Emit JS file (opcional, útil para debug manual)
          compilation.emitAsset(this.assetFilename, new RawSource(this.assetSource));
          ze_log(`${PLUGIN_NAME}: Emitted separate asset: ${this.assetFilename}`);

          // Inject in the main bundle
          const entryAssetName = Object.keys(assets).find(
            (name) =>
              name.endsWith('.js') &&
              (name.includes('main') || name.includes('index') || name.includes('app'))
          );

          if (entryAssetName) {
            const asset = assets[entryAssetName];
            const originalSource = asset.source().toString();

            // Inject straight in to the asset
            if (!originalSource.includes('window[Symbol.for("ze_envs")]')) {
              const injectedSource = `${this.assetSource}\n${originalSource}`;
              compilation.updateAsset(entryAssetName, new RawSource(injectedSource));
              ze_log(`${PLUGIN_NAME}: Injected env vars directly into ${entryAssetName}`);
            } else {
              ze_log(
                `${PLUGIN_NAME}: Env vars already present in ${entryAssetName}, skipping injection`
              );
            }
          } else {
            ze_log(`${PLUGIN_NAME}: Could not find entry JS asset to inject env vars`);
          }
        }
      );

      // Replace env vars in .html and .css
      compilation.hooks.processAssets.tap(
        {
          name: `${PLUGIN_NAME}:ReplaceInAssets`,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        },
        (assets) => {
          if (!this.varsMap) return;

          Object.entries(assets).forEach(([filename, asset]) => {
            if (!/\.(html|css)$/.test(filename)) return;

            let content = asset.source().toString();
            let replaced = false;

            Object.entries(this.varsMap).forEach(([key, value]) => {
              const patterns = [
                new RegExp(`import\\.meta\\.env\\.${key}`, 'g'),
                new RegExp(`process\\.env\\.${key}`, 'g'),
              ];
              patterns.forEach((regex) => {
                if (regex.test(content)) {
                  replaced = true;
                  content = content.replace(regex, JSON.stringify(value));
                }
              });
            });

            if (replaced) {
              ze_log(`${PLUGIN_NAME}: Replaced env vars in ${filename}`);
              compilation.updateAsset(filename, new RawSource(content));
            }
          });
        }
      );

      // Inject the script tag into HTML
      compilation.hooks.processAssets.tap(
        {
          name: `${PLUGIN_NAME}:InjectHtml`,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
        },
        (assets) => {
          if (!this.assetFilename) {
            ze_log(`${PLUGIN_NAME}: No asset filename available for HTML injection`);
            return;
          }

          const publicPath = this.publicPath
            ? `${this.publicPath.replace(/\/$/, '')}/${this.assetFilename}`
            : `/${this.assetFilename}`;
          const scriptTag = `<script src="${publicPath}" fetchpriority="high"></script>`;

          let injectedCount = 0;
          Object.entries(assets).forEach(([filename, asset]) => {
            if (!/\.html$/.test(filename)) return;

            const html = asset.source().toString();

            if (html.includes(this.assetFilename)) {
              ze_log(
                `${PLUGIN_NAME}: Script already injected into ${filename}, skipping`
              );
              return;
            }

            const modifiedHtml = html.replace(/<head[^>]*>/, `$&\n  ${scriptTag}`);

            if (modifiedHtml !== html) {
              ze_log(`${PLUGIN_NAME}: Injecting script tag into ${filename}`);
              compilation.updateAsset(filename, new RawSource(modifiedHtml));
              injectedCount++;
            }
          });

          ze_log(
            `${PLUGIN_NAME}: Injected environment variables script into ${injectedCount} HTML files`
          );
        }
      );

      // HtmlWebpackPlugin hook
      if (HtmlWebpackPlugin.getHooks) {
        HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync(
          PLUGIN_NAME,
          (data, cb) => {
            if (!this.assetFilename) return cb(null, data);

            const publicPath = this.publicPath
              ? `${this.publicPath.replace(/\/$/, '')}/${this.assetFilename}`
              : `/${this.assetFilename}`;
            const scriptTag = `<script src="${publicPath}" fetchpriority="high"></script>`;

            if (data.html.includes(this.assetFilename)) {
              ze_log(
                `${PLUGIN_NAME}: Script already injected by HtmlWebpackPlugin, skipping`
              );
              return cb(null, data);
            }

            ze_log(`${PLUGIN_NAME}: HtmlWebpackPlugin detected, injecting script`);
            data.html = data.html.replace(/<head[^>]*>/, `$&\n  ${scriptTag}`);
            cb(null, data);
          }
        );
      }
    });
  }
}
