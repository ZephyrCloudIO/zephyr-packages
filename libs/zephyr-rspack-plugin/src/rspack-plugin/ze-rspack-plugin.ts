import { ZephyrEngine } from 'zephyr-agent';

import {
  ModuleFederationPlugin,
  logBuildSteps,
  setupZeDeploy,
  BaseHrefOptions
} from 'zephyr-xpack-internal';
import { Compiler } from '@rspack/core';

const pluginName = 'ZeRspackPlugin';

export interface ZephyrRspackInternalPluginOptions {
  zephyr_engine: ZephyrEngine;
  // rspack plugin name
  pluginName: string;
  // federated module config
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  // hacks
  wait_for_index_html?: boolean;
  // outputPath?: string;
  // baseHref configuration
  baseHref?: BaseHrefOptions;
}

export class ZeRspackPlugin {
  _options: ZephyrRspackInternalPluginOptions;

  constructor(options: Omit<ZephyrRspackInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
    
    // Log baseHref configuration if provided
    if (options.baseHref) {
      console.log(`[${pluginName}] BaseHref configuration detected: `, 
        options.baseHref.path || 'Using automatic detection');
    }
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;

    // Check for HtmlRspackPlugin and its base configuration
    if (compiler.options.plugins) {
      interface HtmlPlugin {
        constructor: { name: string };
        options?: { base?: { href?: string } };
      }
      
      const htmlPlugins = compiler.options.plugins.filter((plugin: any) => 
        plugin && plugin.constructor && 
        (plugin.constructor.name === 'HtmlRspackPlugin' || plugin.constructor.name === 'HtmlWebpackPlugin') && 
        plugin.options?.base?.href) as HtmlPlugin[];
      
      if (htmlPlugins.length > 0 && !this._options.baseHref?.path) {
        const htmlPlugin = htmlPlugins[0] as HtmlPlugin;
        if (htmlPlugin.options?.base?.href) {
          console.log(`[${pluginName}] Detected HTML plugin with base.href: ${htmlPlugin.options.base.href}`);
        }
      }
    }

    logBuildSteps(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
