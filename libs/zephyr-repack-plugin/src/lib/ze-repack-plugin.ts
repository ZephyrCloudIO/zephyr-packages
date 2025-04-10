import { Compiler } from '@rspack/core';
import { ZephyrEngine } from 'zephyr-agent';
import {
  ModuleFederationPlugin,
  logBuildSteps,
  setupZeDeploy,
} from 'zephyr-xpack-internal';
import { Platform } from 'zephyr-agent';
const pluginName = 'ZephyrRepackPlugin';
import { generateRuntimeSnapshot } from './generate-runtime-snapshot';
export interface ZephyrRuntimeConfig {
  zephyr_environment?: string;
  tag?: string;
  publicPath?: string;
  snapshotFileName?: string;
  disableEmit?: boolean;
}
export interface ZephyrRepackPluginOptions {
  zephyr_engine: ZephyrEngine;
  pluginName: string;
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  target: Platform | undefined;
  runtimeConfig?: ZephyrRuntimeConfig;
}

export class ZeRepackPlugin {
  _options: ZephyrRepackPluginOptions;

  constructor(options: Omit<ZephyrRepackPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
    logBuildSteps(this._options, compiler);
    Promise.all([
      generateRuntimeSnapshot(this._options, compiler),
      setupZeDeploy(this._options, compiler),
    ]);
  }
}
