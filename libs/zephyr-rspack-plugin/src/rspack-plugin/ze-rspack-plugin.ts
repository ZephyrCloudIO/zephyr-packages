import type { Compiler } from '@rspack/core';
import {
  ZephyrEngine,
} from 'zephyr-agent';

import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import { logBuildSteps, setupZeDeploy } from 'zephyr-xpack-internal';

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
    const zephyrEngine = this._options.zephyr_engine;
    zephyrEngine.buildProperties.output = compiler.outputPath;

    logBuildSteps(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
