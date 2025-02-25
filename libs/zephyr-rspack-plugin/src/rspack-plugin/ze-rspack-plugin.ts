import { ZephyrEngine } from 'zephyr-agent';
import {
  ZeBasePlugin,
  ZeInternalPluginOptions,
  ZeProcessAssetsResult,
  logBuildSteps,
  setupZeDeploy,
} from 'zephyr-xpack-internal';
import { RspackCompiler, ZephyrRspackPluginOptions } from '../types';

/** Internal options for the rspack plugin */
export interface ZephyrRspackInternalPluginOptions extends ZeInternalPluginOptions {
  // Any rspack-specific internal options can be added here
  zephyr_engine: ZephyrEngine; // Override the type to be more specific
}

/** Zephyr Rspack Plugin implementation Extends the base plugin for shared functionality */
export class ZeRspackPlugin extends ZeBasePlugin<
  ZephyrRspackPluginOptions,
  ZephyrRspackInternalPluginOptions
> {
  /** Create a new ZeRspackPlugin instance */
  constructor(options: Omit<ZephyrRspackInternalPluginOptions, 'pluginName'>) {
    super(
      {
        ...options,
        pluginName: 'ZeRspackPlugin',
      } as ZephyrRspackInternalPluginOptions,
      'rspack'
    );
  }

  // Testing helpers are now in the spec file

  /** Apply the plugin to rspack compiler This is called by rspack during initialization */
  apply(compiler: RspackCompiler): void {
    // Set output path on zephyr engine
    this.options.zephyr_engine.buildProperties.output = compiler.outputPath;

    // Set up logging and deployment hooks
    logBuildSteps(this.options, compiler);
    setupZeDeploy(this.options, compiler);
  }

  /**
   * Process assets and create asset map This is automatically called by setupZeDeploy The
   * base class defines this method without parameters, but we don't need them since
   * setupZeDeploy will call the upload agent directly
   */
  protected async processAssets(): Promise<ZeProcessAssetsResult> {
    try {
      // Note: The actual asset processing is handled by the setupZeDeploy function
      // which calls the xpack_zephyr_agent function
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
