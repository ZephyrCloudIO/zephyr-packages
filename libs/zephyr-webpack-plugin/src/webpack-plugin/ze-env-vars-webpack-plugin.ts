import { type ZeEnvVarsPluginOptions } from 'zephyr-xpack-internal';
import type { Compiler } from 'webpack';
import { ze_log, createTemporaryVariablesFile } from 'zephyr-agent';
import path from 'path';

const PLUGIN_NAME = 'ZeEnvVarsWebpackPlugin';

// Global set to collect environment variables across all modules
const GLOBAL_ENV_VARS = new Set<string>();

export class ZeEnvVarsWebpackPlugin {
  private publicPath = '';
  private assetFilename = '';
  private assetSource = '';

  constructor(private options: ZeEnvVarsPluginOptions = {}) {}

  apply(compiler: Compiler): void {
    // Get webpack.sources
    const { RawSource } = compiler.webpack.sources;

    // Register a loader for JS/TS files
    const loaderPath = path.resolve(__dirname, './ze-env-vars-webpack-loader.js');

    // Add the loader to the module rules
    const rules = compiler.options.module?.rules || [];
    rules.push({
      test: /\.(js|jsx|ts|tsx)$/,
      use: [loaderPath],
      enforce: 'pre',
    });

    compiler.options.module = compiler.options.module || {};
    compiler.options.module.rules = rules;

    ze_log(`${PLUGIN_NAME}: Added environment variables loader to webpack rules`);

    // Register the hooks for asset generation and HTML injection
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      ze_log(`${PLUGIN_NAME}: Plugin initialized`);

      // Add a custom loader to process JS/TS files
      compilation.hooks.normalModuleLoader.tap(PLUGIN_NAME, (loaderContext) => {
        // Store a reference to the global environment variables set
        //@ts-expect-error - zeEnvVars is injected into the loader context
        loaderContext.zeEnvVars = GLOBAL_ENV_VARS;
      });

      // Process assets to generate the environment variables asset
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        },
        () => {
          if (GLOBAL_ENV_VARS.size === 0) {
            ze_log(
              `${PLUGIN_NAME}: No environment variables detected, skipping asset generation`
            );
            return;
          }

          ze_log(
            `${PLUGIN_NAME}: Collected env vars: ${Array.from(GLOBAL_ENV_VARS).join(', ')}`
          );

          // Generate the environment variables asset using the agent's createTemporaryVariablesFile
          const { source, hash } = createTemporaryVariablesFile(GLOBAL_ENV_VARS);
          this.assetFilename = `ze-envs-${hash}.js`;
          this.assetSource = source;

          // Get the public path from compiler options
          this.publicPath = (compiler.options.output?.publicPath as string) || '';
          if (this.publicPath === 'auto') this.publicPath = '';

          // Add the environment variables asset to the compilation
          ze_log(
            `${PLUGIN_NAME}: Adding environment variables asset: ${this.assetFilename}`
          );
          compilation.emitAsset(this.assetFilename, new RawSource(this.assetSource));
        }
      );

      // Inject the script tag into HTML files
      compilation.hooks.processAssets.tap(
        {
          name: `${PLUGIN_NAME}:InjectHtml`,
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER, // This runs after asset optimization
        },
        (assets) => {
          if (!this.assetFilename) {
            ze_log(`${PLUGIN_NAME}: No asset filename available for HTML injection`);
            return;
          }

          // Create the script tag
          const publicPath = this.publicPath
            ? `${this.publicPath.replace(/\/$/, '')}/${this.assetFilename}`
            : `/${this.assetFilename}`;
          const scriptTag = `<script src="${publicPath}" fetchpriority="high"></script>`;

          // Process HTML assets to inject the script tag
          let injectedCount = 0;
          Object.entries(assets).forEach(([filename, asset]) => {
            if (!/\.html$/.test(filename)) {
              return;
            }

            const html = asset.source().toString();

            // Inject the script tag into the head
            const modifiedHtml = html.replace(/<head[^>]*>/, `$&\n  ${scriptTag}`);

            // Only update if there's a change
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

      // Look for HtmlWebpackPlugin instance
      const htmlWebpackPlugin = compiler.options.plugins?.find(
        (plugin) => plugin?.constructor?.name === 'HtmlWebpackPlugin'
      );

      // Add support for HtmlWebpackPlugin
      if (htmlWebpackPlugin) {
        // Create the script tag
        const publicPath = this.publicPath
          ? `${this.publicPath.replace(/\/$/, '')}/${this.assetFilename}`
          : `/${this.assetFilename}`;
        const scriptTag = `<script src="${publicPath}" fetchpriority="high"></script>`;

        // @ts-expect-error - Tap into the HTML generation hook
        compilation.hooks.htmlWebpackPluginAfterHtmlProcessing?.tap(
          PLUGIN_NAME,
          // @ts-expect-error - Tap into the HTML generation hook
          (data) => {
            if (!this.assetFilename) {
              return data;
            }

            ze_log(`${PLUGIN_NAME}: HtmlWebpackPlugin detected, injecting script`);
            data.html = data.html.replace(/<head[^>]*>/, `$&\n  ${scriptTag}`);
            return data;
          }
        );
      }
    });
  }
}
