import { ZephyrEngine } from 'zephyr-agent';
import {
  ZeBasePlugin,
  ZeInternalPluginOptions,
  ZeProcessAssetsResult,
  logBuildSteps,
  setupZeDeploy,
} from 'zephyr-xpack-internal';
import { WebpackCompiler, ZephyrWebpackPluginOptions } from '../types';

/** Internal options for the webpack plugin */
export interface ZephyrWebpackInternalPluginOptions extends ZeInternalPluginOptions {
  // Any webpack-specific internal options can be added here
  zephyr_engine: ZephyrEngine; // Override the type to be more specific
}

/** Zephyr Webpack Plugin implementation Extends the base plugin for shared functionality */
export class ZeWebpackPlugin extends ZeBasePlugin<
  ZephyrWebpackPluginOptions,
  ZephyrWebpackInternalPluginOptions
> {
  /** Create a new ZeWebpackPlugin instance */
  constructor(options: Omit<ZephyrWebpackInternalPluginOptions, 'pluginName'>) {
    super(
      {
        ...options,
        pluginName: 'ZeWebpackPlugin',
      } as ZephyrWebpackInternalPluginOptions,
      'webpack'
    );
  }

  /** Apply the plugin to webpack compiler This is called by webpack during initialization */
  apply(compiler: WebpackCompiler): void {
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
