import type { Compiler } from 'webpack';
import { ZephyrEngine } from 'zephyr-agent';

import { setupZeDeploy } from './ze-setup-ze-deploy';
import { ModuleFederationPlugin, logBuildSteps } from 'zephyr-xpack-internal';

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

    logBuildSteps<ZephyrWebpackInternalPluginOptions, Compiler>(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
