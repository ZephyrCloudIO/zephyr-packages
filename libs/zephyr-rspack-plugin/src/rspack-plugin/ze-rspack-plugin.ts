import { ZephyrEngine } from 'zephyr-agent';

import { setupZeDeploy } from './ze-setup-ze-deploy';
import { ModuleFederationPlugin, logBuildSteps } from 'zephyr-xpack-internal';
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
}

export class ZeRspackPlugin {
  _options: ZephyrRspackInternalPluginOptions;

  constructor(options: Omit<ZephyrRspackInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;

    logBuildSteps<ZephyrRspackInternalPluginOptions, Compiler>(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
