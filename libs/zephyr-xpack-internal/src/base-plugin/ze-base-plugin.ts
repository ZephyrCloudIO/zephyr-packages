/**
 * Provides a common architecture and shared functionality across different bundler
 * plugins
 *
 * @file Base plugin implementation for Zephyr bundler plugins
 */

import { ZeBundlerType, ZeInternalPluginOptions, ZePluginOptions } from '../xpack.types';

/**
 * Result of asset processing operation
 *
 * @interface ZeProcessAssetsResult
 */
export interface ZeProcessAssetsResult {
  /**
   * Indicates if the processing was successful
   *
   * @type {boolean}
   */
  success: boolean;

  /**
   * Error message if processing failed
   *
   * @type {string}
   * @optional
   */
  error?: string;
}

/**
 * Abstract base class for Zephyr plugins
 *
 * This class serves as the foundation for all bundler-specific Zephyr plugins, providing
 * common functionality, type safety, and a consistent interface. Bundler-specific plugins
 * should extend this class and implement the abstract processAssets method.
 *
 * @abstract
 * @template _TOptions - Public options type that extends ZePluginOptions
 * @template Internal - Internal options type that extends ZeInternalPluginOptions
 * @class ZeBasePlugin
 */
export abstract class ZeBasePlugin<
  // Type option for future implementation - NOSONAR
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  _TOptions extends ZePluginOptions = ZePluginOptions,
  Internal extends ZeInternalPluginOptions = ZeInternalPluginOptions,
> {
  /**
   * Internal plugin options
   *
   * @type {Internal}
   * @protected
   */
  protected options: Internal;

  /**
   * The type of bundler this plugin is for
   *
   * @type {ZeBundlerType}
   * @protected
   * @readonly
   */
  protected readonly bundlerType: ZeBundlerType;

  /**
   * Plugin name for logging and identification
   *
   * @type {string}
   * @protected
   * @readonly
   */
  protected readonly pluginName: string;

  /**
   * Creates a new ZeBasePlugin instance
   *
   * @class
   * @param {Internal} options - Internal plugin options
   * @param {ZeBundlerType} bundlerType - The type of bundler this plugin is for
   */
  constructor(options: Internal, bundlerType: ZeBundlerType) {
    this.options = options;
    this.bundlerType = bundlerType;
    this.pluginName = options.pluginName || `zephyr-${bundlerType}-plugin`;
  }

  /**
   * Initializes the plugin
   *
   * Called at the start of the build process. This method can be overridden by subclasses
   * to perform additional initialization logic.
   *
   * @async
   * @returns {Promise<void>}
   * @protected
   */
  protected async initialize(): Promise<void> {
    try {
      this.log(`Initializing ${this.pluginName}`);
      // Implementation will be provided by specific plugins if needed
    } catch (error) {
      this.logError(
        `Error initializing plugin: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Processes assets and creates an asset map
   *
   * This is the core method that must be implemented by all subclasses. Each bundler
   * plugin will implement this method according to its specific asset handling
   * requirements.
   *
   * @async
   * @abstract
   * @returns {Promise<ZeProcessAssetsResult>} Result of the asset processing operation
   * @protected
   */
  protected abstract processAssets(): Promise<ZeProcessAssetsResult>;

  /**
   * Logs a message for debugging
   *
   * @param {string} message - The message to log
   * @returns {void}
   * @protected
   */
  protected log(message: string): void {
    console.log(`[${this.pluginName}] ${message}`);
  }

  /**
   * Logs an error message
   *
   * @param {string} message - The error message to log
   * @returns {void}
   * @protected
   */
  protected logError(message: string): void {
    console.error(`[${this.pluginName}] ERROR: ${message}`);
  }

  /**
   * Logs a warning message
   *
   * @param {string} message - The warning message to log
   * @returns {void}
   * @protected
   */
  protected logWarning(message: string): void {
    console.warn(`[${this.pluginName}] WARNING: ${message}`);
  }

  /**
   * Creates plugin options by merging defaults with user-provided options
   *
   * Uses the TOptions generic parameter to ensure type safety.
   *
   * @template T - Options type that extends ZePluginOptions
   * @param {Partial<T>} userOptions - User-provided options
   * @param {Partial<T>} defaults - Default options
   * @returns {T} Merged options
   * @protected
   * @static
   */
  protected static createOptions<T extends ZePluginOptions>(
    userOptions: Partial<T> = {},
    defaults: Partial<T> = {}
  ): T {
    return {
      ...defaults,
      ...userOptions,
    } as T;
  }
}

/**
 * Factory function to create a Zephyr plugin instance
 *
 * This utility function simplifies the creation of plugins with proper typing.
 *
 * @template P - Plugin type that extends ZeBasePlugin
 * @template O - Public options type that extends ZePluginOptions
 * @template I - Internal options type that extends ZeInternalPluginOptions
 * @param {new (options: I, bundlerType: ZeBundlerType) => P} PluginClass - Plugin
 *   constructor
 * @param {I} options - Plugin options
 * @param {ZeBundlerType} bundlerType - The type of bundler
 * @returns {P} A new plugin instance
 */
export function createZePlugin<
  P extends ZeBasePlugin<O, I>,
  O extends ZePluginOptions = ZePluginOptions,
  I extends ZeInternalPluginOptions = ZeInternalPluginOptions,
>(
  PluginClass: new (options: I, bundlerType: ZeBundlerType) => P,
  options: I,
  bundlerType: ZeBundlerType
): P {
  return new PluginClass(options, bundlerType);
}
