/**
 * Implements the Zephyr integration for webpack-based applications
 *
 * @file Zephyr Webpack Plugin implementation
 */

import { ZephyrEngine } from 'zephyr-agent';
import {
  ZeBasePlugin,
  ZeInternalPluginOptions,
  ZeProcessAssetsResult,
  logBuildSteps,
  setupZeDeploy,
} from 'zephyr-xpack-internal';
import { WebpackCompiler, ZephyrWebpackPluginOptions } from '../types';

/**
 * Internal options for the webpack plugin
 *
 * @extends {ZeInternalPluginOptions}
 * @interface ZephyrWebpackInternalPluginOptions
 */
export interface ZephyrWebpackInternalPluginOptions extends ZeInternalPluginOptions {
  /**
   * The Zephyr Engine instance with proper typing
   *
   * @type {ZephyrEngine}
   */
  zephyr_engine: ZephyrEngine; // Override the type to be more specific
}

/**
 * Zephyr Webpack Plugin implementation
 *
 * Extends the base plugin for shared functionality and implements webpack-specific logic.
 *
 * @class ZeWebpackPlugin
 * @extends {ZeBasePlugin<
 *   ZephyrWebpackPluginOptions,
 *   ZephyrWebpackInternalPluginOptions
 * >}
 */
export class ZeWebpackPlugin extends ZeBasePlugin<
  ZephyrWebpackPluginOptions,
  ZephyrWebpackInternalPluginOptions
> {
  /**
   * Creates a new ZeWebpackPlugin instance
   *
   * @class
   * @param {Omit<ZephyrWebpackInternalPluginOptions, 'pluginName'>} options - Plugin
   *   options without pluginName
   */
  constructor(options: Omit<ZephyrWebpackInternalPluginOptions, 'pluginName'>) {
    super(
      {
        ...options,
        pluginName: 'ZeWebpackPlugin',
      } as ZephyrWebpackInternalPluginOptions,
      'webpack'
    );
  }

  /**
   * Applies the plugin to webpack compiler
   *
   * This is called by webpack during initialization. It sets up the plugin hooks and
   * configures the Zephyr engine.
   *
   * @param {WebpackCompiler} compiler - The webpack compiler instance
   * @returns {void}
   */
  apply(compiler: WebpackCompiler): void {
    // Set output path on zephyr engine
    this.options.zephyr_engine.buildProperties.output = compiler.outputPath;

    // Set up logging and deployment hooks
    logBuildSteps(this.options, compiler);
    setupZeDeploy(this.options, compiler);
  }

  /**
   * Process assets and create asset map
   *
   * This is automatically called by setupZeDeploy. The base class defines this method
   * without parameters, but we don't need them since setupZeDeploy will call the upload
   * agent directly.
   *
   * @async
   * @returns {Promise<ZeProcessAssetsResult>} Result of asset processing
   * @protected
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
