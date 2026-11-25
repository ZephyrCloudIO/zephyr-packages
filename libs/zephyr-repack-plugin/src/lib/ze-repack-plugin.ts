import type { Compiler } from '@rspack/core';
import * as path from 'node:path';
import type { ZephyrEngine, ZephyrBuildHooks } from 'zephyr-agent';
import { ZeErrors, ZephyrError } from 'zephyr-agent';
import type { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import {
  logBuildSteps,
  setupManifestEmission,
  setupZeDeploy,
} from 'zephyr-xpack-internal';
import {
  assertNativeBuildTarget,
  type DownloadedRemote,
  type NativeBuildTarget,
  writeEmbeddedRemoteFiles,
} from 'zephyr-native-internal';
const pluginName = 'ZephyrRepackPlugin';

export interface ZephyrRepackPluginOptions {
  zephyr_engine: ZephyrEngine;
  pluginName: string;
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  target: NativeBuildTarget;
  hooks?: ZephyrBuildHooks;
  /** Remotes to ship inside the app (`embedRemotes` in zephyr.config.*). */
  embeddedRemotes?: DownloadedRemote[];
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

    const { embeddedRemotes, target } = this.#options;
    if (embeddedRemotes?.length) {
      compiler.hooks.afterEmit.tapPromise(pluginName, async () => {
        const bundleFile = process.env['REPACK_BUNDLE_FILENAME'];
        if (!bundleFile) {
          throw new ZephyrError(ZeErrors.ERR_EMBED_REMOTES, {
            detail:
              'Re.Pack did not report --bundle-output; build with the Re.Pack bundle command',
          });
        }
        // Where Re.Pack's AssetsCopyProcessor puts local chunks, which the native build packages.
        const bundleDir = path.dirname(path.resolve(compiler.context, bundleFile));
        const dest =
          target === 'ios'
            ? path.resolve(
                compiler.context,
                process.env['REPACK_ASSETS_DEST'] ?? bundleDir
              )
            : bundleDir;
        writeEmbeddedRemoteFiles(embeddedRemotes, dest);
      });
    }
  }
}
