import type { Compiler } from 'webpack';
import type { ZephyrEngine } from 'zephyr-agent';

import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import {
  detectAndStoreBaseHref,
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
    // Set output path
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;

    // Detect base href
    detectAndStoreBaseHref(this._options.zephyr_engine, compiler);

    // Log build steps
    logBuildSteps(this._options, compiler);

    // Setup deployment
    setupZeDeploy(this._options, compiler);
  }
}
