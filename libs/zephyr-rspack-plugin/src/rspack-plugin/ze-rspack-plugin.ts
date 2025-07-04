import type { ZephyrEngine } from 'zephyr-agent';

import type { Compiler } from '@rspack/core';
import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import {
  detectAndStoreBaseHref,
  logBuildSteps,
  setupZeDeploy,
  setupManifestEmission,
} from 'zephyr-xpack-internal';

const pluginName = 'ZeRspackPlugin';

export interface ZephyrRspackInternalPluginOptions {
  zephyr_engine: ZephyrEngine;
  // rspack plugin name
  pluginName: string;
  // federated module config
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  // hacks
  wait_for_index_html?: boolean;
  // Runtime plugin option
  runtimePlugin?: boolean;
  // outputPath?: string;
}

export class ZeRspackPlugin {
  _options: ZephyrRspackInternalPluginOptions;

  constructor(options: Omit<ZephyrRspackInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
    detectAndStoreBaseHref(this._options.zephyr_engine, compiler);
    logBuildSteps(this._options, compiler);
    setupManifestEmission(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
