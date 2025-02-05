import type { Compiler } from 'webpack';
import { ZephyrEngine } from 'zephyr-agent';

import {
  ModuleFederationPlugin,
  logBuildSteps,
  setupZeDeploy,
} from 'zephyr-xpack-internal';

const pluginName = 'ZeWebpackPlugin';

export interface ZephyrWebpackInternalPluginOptions {
  zephyr_engine: ZephyrEngine;
  // webpack plugin name
  pluginName: string;
  // federated module config
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  // hacks
  wait_for_index_html?: boolean;
  // outputPath?: string;
}

export class ZeWebpackPlugin {
  _options: ZephyrWebpackInternalPluginOptions;

  constructor(options: Omit<ZephyrWebpackInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;

    if (process.env['ZE_CI_TEST']) {
      compiler.hooks.emit.tapAsync(
        this._options.pluginName,
        async (compilation, callback) => {
          const htmlFiles = Object.keys(compilation.assets).filter((file) =>
            file.endsWith('.html')
          );

          for (const htmlFile of htmlFiles) {
            const asset = compilation.assets[htmlFile];
            const content = asset.source().toString();
            const modifiedContent =
              await this._options.zephyr_engine.injectBuildIdMeta(content);

            console.log('modifiedContent', modifiedContent);

            compilation.assets[htmlFile] = {
              source: () => modifiedContent,
              size: () => modifiedContent.length,
              map: () => null,
              sourceAndMap: () => ({
                source: modifiedContent,
                map: {},
              }),
              updateHash: (hash: any) => {
                hash.update(modifiedContent);
              },
              buffer: () => Buffer.from(modifiedContent),
            };
          }

          callback();
        }
      );
    }

    logBuildSteps(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
