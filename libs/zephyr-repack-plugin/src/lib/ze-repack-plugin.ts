import { Compiler } from '@rspack/core';
import { ZephyrEngine } from 'zephyr-agent';
import { ModuleFederationPlugin } from 'zephyr-xpack-internal';
import { ZeRepackPlugin as ZeBaseRepackPlugin } from './ze-base-repack-plugin';

const pluginName = 'ZephyrRepackPlugin';

/** @deprecated Use the new ZeRepackPlugin from ze-base-repack-plugin.ts instead */
export interface ZephyrRepackPluginOptions {
  zephyr_engine: ZephyrEngine;
  pluginName: string;
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  target: 'ios' | 'android' | 'web' | undefined;
}

/**
 * Legacy implementation for backward compatibility
 *
 * @deprecated Use the new ZeRepackPlugin from ze-base-repack-plugin.ts instead
 */
export class ZeRepackPlugin {
  _options: ZephyrRepackPluginOptions;
  private _basePlugin: ZeBaseRepackPlugin;

  constructor(options: Omit<ZephyrRepackPluginOptions, 'pluginName'>) {
    this._options = Object.assign({ pluginName }, options);

    // Create an instance of the new base plugin
    this._basePlugin = new ZeBaseRepackPlugin({
      zephyr_engine: options.zephyr_engine,
      target: options.target,
      mfConfig: options.mfConfig,
    });
  }

  apply(compiler: Compiler): void {
    // Delegate to the new base plugin implementation
    this._basePlugin.apply(compiler);

    // For backward compatibility, ensure _options.zephyr_engine.buildProperties.output is set
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
  }
}
