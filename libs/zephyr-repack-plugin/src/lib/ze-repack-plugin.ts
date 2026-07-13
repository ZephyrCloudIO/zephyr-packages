import type { Compiler } from '@rspack/core';
import type { ZephyrEngine, ZephyrBuildHooks } from 'zephyr-agent';
import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import { logBuildSteps, setupZeDeploy } from 'zephyr-xpack-internal';
import {
  assertRepackNativeBuildTarget,
  type RepackNativeBuildTarget,
} from './native-target';
const pluginName = 'ZephyrRepackPlugin';

export interface ZephyrRepackPluginOptions {
  zephyr_engine: ZephyrEngine;
  pluginName: string;
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  target: RepackNativeBuildTarget;
  hooks?: ZephyrBuildHooks;
}

export interface ZephyrRepackOptions {
  target?: RepackNativeBuildTarget;
  hooks?: ZephyrBuildHooks;
}

export class ZeRepackPlugin {
  #options: ZephyrRepackPluginOptions;

  constructor(options: Omit<ZephyrRepackPluginOptions, 'pluginName'>) {
    assertRepackNativeBuildTarget(options.target, 'ZeRepackPlugin target');
    this.#options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    const engineTarget = this.#options.zephyr_engine.env.target;
    assertRepackNativeBuildTarget(engineTarget, 'ZeRepackPlugin engine target');
    if (engineTarget !== this.#options.target) {
      throw new TypeError(
        `ZeRepackPlugin engine target must match target ${JSON.stringify(
          this.#options.target
        )}; received ${JSON.stringify(engineTarget)}.`
      );
    }

    this.#options.zephyr_engine.buildProperties.output = compiler.outputPath;
    logBuildSteps(this.#options, compiler);
    setupZeDeploy(this.#options, compiler);
  }
}
