import { Compiler } from '@rspack/core';
import { log_build_steps } from './set-up-build-stats-logging';
import { setup_deploy } from './set-up-deploy';
import { ZephyrEngine } from 'zephyr-agent';
import { ModuleFederationPlugin } from 'zephyr-xpack-internal';

const pluginName = 'ZephyrRepackPlugin';

export interface ZephyrRepackPluginOptions {
  zephyr_engine: ZephyrEngine;
  pluginName: string;
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  upload_file: boolean;
  target: 'ios' | 'android' | 'web' | undefined;
}

export class ZeRepackPlugin {
  _options: ZephyrRepackPluginOptions;

  constructor(options: Omit<ZephyrRepackPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
    log_build_steps(this._options, compiler);
    setup_deploy(this._options, compiler);
  }
}
