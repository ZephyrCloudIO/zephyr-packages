import type { Compiler } from '@rspack/core';
import type { ZephyrEngine, ZephyrBuildHooks } from 'zephyr-agent';
import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import { logBuildSteps, setupZeDeploy } from 'zephyr-xpack-internal';
import type { Platform } from 'zephyr-agent';
const pluginName = 'ZephyrRepackPlugin';

export interface ZephyrRepackPluginOptions {
  zephyr_engine: ZephyrEngine;
  pluginName: string;
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  target: Platform | undefined;
  hooks?: ZephyrBuildHooks;
}

export class ZeRepackPlugin {
  _options: ZephyrRepackPluginOptions;

  constructor(options: Omit<ZephyrRepackPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
    logBuildSteps(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
