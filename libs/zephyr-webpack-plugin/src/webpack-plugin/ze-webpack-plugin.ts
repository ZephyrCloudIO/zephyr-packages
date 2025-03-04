import type { Compiler } from 'webpack';
import { ZephyrEngine } from 'zephyr-agent';

import {
  ModuleFederationPlugin,
  logBuildSteps,
  setupZeDeploy,
} from 'zephyr-xpack-internal';

// Import BaseHref types
import { BaseHrefOptions } from 'zephyr-xpack-internal/src/basehref/webpack-basehref-integration';

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
  // baseHref configuration
  baseHref?: BaseHrefOptions;
}

export class ZeWebpackPlugin {
  _options: ZephyrWebpackInternalPluginOptions;

  constructor(options: Omit<ZephyrWebpackInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
    
    // Log baseHref configuration if provided
    if (options.baseHref) {
      console.log(`[${pluginName}] BaseHref configuration detected: `, 
        options.baseHref.path || 'Using automatic detection');
    }
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;

    // Check for HtmlWebpackPlugin and its base configuration
    if (compiler.options.plugins) {
      const htmlPlugins = compiler.options.plugins.filter((plugin: any) => 
        plugin && plugin.constructor && plugin.constructor.name === 'HtmlWebpackPlugin' && 
        plugin.options?.base?.href);
      
      if (htmlPlugins.length > 0 && !this._options.baseHref?.path) {
        console.log(`[${pluginName}] Detected HtmlWebpackPlugin with base.href: ${htmlPlugins[0].options.base.href}`);
      }
    }

    logBuildSteps(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
