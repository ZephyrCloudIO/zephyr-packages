import type { Compiler } from 'webpack';
import type { ZephyrEngine, ZephyrBuildHooks } from 'zephyr-agent';

import type {
  ModuleFederationPlugin,
  XPackBuildCoordinator,
} from 'zephyr-xpack-internal';
import {
  detectBaseHref,
  detectAndStoreBaseHref,
  logBuildSteps,
  setupManifestEmission,
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
  hooks?: ZephyrBuildHooks;
  coordinator?: XPackBuildCoordinator;
  participant?: string;
  assetPrefix?: string;
}

export class ZeWebpackPlugin {
  _options: ZephyrWebpackInternalPluginOptions;

  constructor(options: Omit<ZephyrWebpackInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
    if (this._options.coordinator && this._options.participant) {
      this._options.coordinator.registerParticipantBaseHref(
        this._options.participant,
        detectBaseHref(compiler)
      );
    } else {
      detectAndStoreBaseHref(this._options.zephyr_engine, compiler);
    }
    logBuildSteps(this._options, compiler);
    setupManifestEmission(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
