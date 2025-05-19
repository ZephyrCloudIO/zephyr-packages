import { ZephyrEngine } from 'zephyr-agent';

import type { Compiler } from '@rspack/core';
import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import {
  extractFederatedDependencyPairs,
  logBuildSteps,
  mutWebpackFederatedRemotesConfig,
  setupZeDeploy,
} from 'zephyr-xpack-internal';

const pluginName = 'ZeRspackPlugin';

export interface ZephyrRspackInternalPluginOptions {
  zephyr_engine: ZephyrEngine | Promise<ZephyrEngine>;
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
    if (this._options.zephyr_engine instanceof ZephyrEngine) {
      this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
    }

    logBuildSteps(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}

export class ZephyrPlugin {
  _options: ZephyrRspackInternalPluginOptions;

  constructor(options: Omit<ZephyrRspackInternalPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    const { zephyr_defer_create, zephyr_engine_defer } = ZephyrEngine.defer_create();

    zephyr_defer_create({ builder: 'rspack', context: compiler.context });
    zephyr_engine_defer.then((engine) => {
      engine.buildProperties.output = compiler.outputPath;
    });

    compiler.hooks.beforeRun.tapPromise(this._options.pluginName, async (compiler) => {
      if (this._options.zephyr_engine instanceof Promise) {
        this._options.zephyr_engine = await this._options.zephyr_engine;
      }
      // Resolve dependencies and update the config
      const dependencyPairs = extractFederatedDependencyPairs(compiler.options);

      const resolved_dependency_pairs =
        await this._options.zephyr_engine.resolve_remote_dependencies(dependencyPairs);

      mutWebpackFederatedRemotesConfig(
        this._options.zephyr_engine,
        compiler.options,
        resolved_dependency_pairs
      );
    });

    logBuildSteps(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
