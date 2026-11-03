import type { Compiler } from '@rspack/core';
import type { ZephyrEngine, ZephyrBuildHooks } from 'zephyr-agent';
import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import {
  logBuildSteps,
  setupManifestEmission,
  setupZeDeploy,
} from 'zephyr-xpack-internal';
import { assertNativeBuildTarget, type NativeBuildTarget } from 'zephyr-native-internal';
const pluginName = 'ZephyrRepackPlugin';

export interface ZephyrRepackPluginOptions {
  zephyr_engine: ZephyrEngine;
  pluginName: string;
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  target: NativeBuildTarget;
  hooks?: ZephyrBuildHooks;
}

export interface ZephyrRepackOptions {
  target?: NativeBuildTarget;
  hooks?: ZephyrBuildHooks;
  /**
   * Tag or environment whose `zephyr-manifest.json` this app reads at runtime, in
   * `zephyr:dependencies` selector syntax: `@production-${target}` for this app's own
   * label, `app@label` for another app's. Its remote overrides and `ZE_PUBLIC_*` values
   * apply from the launch after they are fetched.
   */
  runtimeManifest?: string;
}

export class ZeRepackPlugin {
  #options: ZephyrRepackPluginOptions;

  constructor(options: Omit<ZephyrRepackPluginOptions, 'pluginName'>) {
    assertNativeBuildTarget(options.target, 'ZeRepackPlugin target', 'repack');
    this.#options = Object.assign({ pluginName }, options);
  }

  apply(compiler: Compiler): void {
    const engineTarget = this.#options.zephyr_engine.env.target;
    assertNativeBuildTarget(engineTarget, 'ZeRepackPlugin engine target', 'repack');
    if (engineTarget !== this.#options.target) {
      throw new TypeError(
        `ZeRepackPlugin engine target must match target ${JSON.stringify(
          this.#options.target
        )}; received ${JSON.stringify(engineTarget)}.`
      );
    }

    this.#options.zephyr_engine.buildProperties.output = compiler.outputPath;
    logBuildSteps(this.#options, compiler);
    setupManifestEmission(this.#options, compiler);
    setupZeDeploy(this.#options, compiler);
  }
}
