import type { Compiler } from 'webpack';
import { ZephyrEngine } from 'zephyr-agent';

import {
  ModuleFederationPlugin,
  logBuildSteps,
  setupZeDeploy,
} from 'zephyr-xpack-internal';
import { detectAndStoreBaseHref } from 'zephyr-xpack-internal/src/basehref/webpack-basehref-integration';

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
  // optional base href for assets
  baseHref?: string;
}

export class ZeWebpackPlugin {
  _options: ZephyrWebpackInternalPluginOptions;

  constructor(options: Omit<ZephyrWebpackInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
    
    // Detect and store baseHref from configuration
    detectAndStoreBaseHref(this._options.zephyr_engine, compiler, this._options);

    logBuildSteps(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
