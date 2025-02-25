import { Compiler } from '@rspack/core';
import {
  ZeBasePlugin,
  ZeProcessAssetsResult,
  logBuildSteps,
  setupZeDeploy,
} from 'zephyr-xpack-internal';
import { ZephyrRepackInternalPluginOptions, ZephyrRepackPluginOptions } from './types';

const PLUGIN_NAME = 'ZeRepackPlugin';

/** Repack plugin implementation that extends the base Zephyr plugin */
export class ZeRepackPlugin extends ZeBasePlugin<
  ZephyrRepackPluginOptions,
  ZephyrRepackInternalPluginOptions
> {
  /**
   * Create a new ZeRepackPlugin instance
   *
   * @param options - Internal plugin options
   */
  constructor(options: Omit<ZephyrRepackInternalPluginOptions, 'pluginName'>) {
    super(
      {
        ...options,
        pluginName: PLUGIN_NAME,
      },
      'repack'
    );
  }

  /**
   * Apply the plugin to the Repack compiler This is called by Repack during
   * initialization
   *
   * @param compiler - The Repack compiler instance
   */
  apply(compiler: Compiler): void {
    // Set output path on zephyr engine
    this.options.zephyr_engine.buildProperties.output = compiler.outputPath;

    // Log target platform
    if (this.options.target) {
      this.log(`Building for platform: ${this.options.target}`);
    }

    // Set up logging and deployment hooks
    logBuildSteps(this.options, compiler);
    setupZeDeploy(this.options, compiler);
  }

  /** Process assets and create asset map This is automatically called by setupZeDeploy */
  protected async processAssets(): Promise<ZeProcessAssetsResult> {
    try {
      // The actual asset processing is handled by the setupZeDeploy function
      // which calls the xpack_zephyr_agent function with platform-specific logic
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
