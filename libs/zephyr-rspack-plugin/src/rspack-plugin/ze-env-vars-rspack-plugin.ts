import { type ZeEnvVarsPluginOptions } from 'zephyr-xpack-internal';
import type { Compiler } from '@rspack/core';
import { ze_log, createTemporaryVariablesFile } from 'zephyr-agent';
import { getGlobalEnvVars } from './ze-env-vars-rspack-loader';
import path from 'path';

const PLUGIN_NAME = 'ZeEnvVarsRspackPlugin';

export class ZeEnvVarsRspackPlugin {
  private publicPath = '';
  private assetFilename = '';
  private assetSource = '';

  constructor(private options: ZeEnvVarsPluginOptions = {}) {}

  apply(compiler: Compiler): void {
    const { webpack } = compiler;
    const { RawSource } = webpack.sources;

    // Add loader for JS/TS files
    const rules = compiler.options.module?.rules || [];

    // Register the loader
    const loaderPath = path.resolve(__dirname, './ze-env-vars-rspack-loader');
    ze_log(`${PLUGIN_NAME}: Registering loader at ${loaderPath}`);

    rules.push({
      test: /\.(js|jsx|ts|tsx)$/,
      use: [loaderPath],
      enforce: 'pre', // Run before other loaders
    });

    compiler.options.module = compiler.options.module || {};
    compiler.options.module.rules = rules;

    ze_log(`${PLUGIN_NAME}: Added environment variables loader to webpack rules`);

    // Register hooks to generate the env asset and inject into HTML
    compiler.hooks.compilation.tap(PLUGIN_NAME, (compilation) => {
      ze_log(`${PLUGIN_NAME}: Plugin initialized`);

      // Use emission hook to generate the asset
      compilation.hooks.processAssets.tap(
        {
          name: PLUGIN_NAME,
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE,
        },
        () => {
          // Get the variables from the global set populated by the loader
          const variablesSet = getGlobalEnvVars();

          if (variablesSet.size === 0) {
            ze_log(
              `${PLUGIN_NAME}: No environment variables detected, skipping asset generation`
            );
            return;
          }

          ze_log(
            `${PLUGIN_NAME}: Collected env vars: ${Array.from(variablesSet).join(', ')}`
          );

          // Generate the environment variables asset using the agent's createTemporaryVariablesFile
          const { source, hash } = createTemporaryVariablesFile(variablesSet);
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
          stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER, // This runs after asset optimization
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

      // Add support for HtmlWebpackPlugin if available
      // @ts-expect-error - Check for HtmlWebpackPlugin
      if (compilation.hooks.htmlWebpackPluginAfterHtmlProcessing) {
        // Create the script tag
        const publicPath = this.publicPath
          ? `${this.publicPath.replace(/\/$/, '')}/${this.assetFilename}`
          : `/${this.assetFilename}`;
        const scriptTag = `<script src="${publicPath}" fetchpriority="high"></script>`;

        // @ts-expect-error - Tap into the HTML generation hook
        compilation.hooks.htmlWebpackPluginAfterHtmlProcessing.tap(
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
