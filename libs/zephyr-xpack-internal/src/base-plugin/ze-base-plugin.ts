/**
 * Base plugin implementation for Zephyr plugins Provides common functionality across
 * different bundler plugins
 */

import { ZeBundlerType, ZeInternalPluginOptions, ZePluginOptions } from '../xpack.types';

/** Result of asset processing */
export interface ZeProcessAssetsResult {
  /** Indicates if the processing was successful */
  success: boolean;

  /** Error message if processing failed */
  error?: string;
}

/**
 * Abstract base class for Zephyr plugins Bundler-specific plugins should extend this
 * class
 */
export abstract class ZeBasePlugin<
  // Type option for future implementation - NOSONAR
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  _TOptions extends ZePluginOptions = ZePluginOptions,
  Internal extends ZeInternalPluginOptions = ZeInternalPluginOptions,
> {
  /** Internal plugin options */
  protected options: Internal;

  /** The type of bundler this plugin is for */
  protected readonly bundlerType: ZeBundlerType;

  /** Plugin name for logging and identification */
  protected readonly pluginName: string;

  /** Create a new ZeBasePlugin instance */
  constructor(options: Internal, bundlerType: ZeBundlerType) {
    this.options = options;
    this.bundlerType = bundlerType;
    this.pluginName = options.pluginName || `zephyr-${bundlerType}-plugin`;
  }

  /** Initialize the plugin Called at the start of the build process */
  protected async initialize(): Promise<void> {
    try {
      this.log(`Initializing ${this.pluginName}`);
      // Implementation will be provided by specific plugins
    } catch (error) {
      this.logError(
        `Error initializing plugin: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Process assets and create asset map This is where most bundler-specific logic will be
   * implemented
   */
  protected abstract processAssets(): Promise<ZeProcessAssetsResult>;

  /** Log message for debugging */
  protected log(message: string): void {
    console.log(`[${this.pluginName}] ${message}`);
  }

  /** Log error message */
  protected logError(message: string): void {
    console.error(`[${this.pluginName}] ERROR: ${message}`);
  }

  /** Log warning message */
  protected logWarning(message: string): void {
    console.warn(`[${this.pluginName}] WARNING: ${message}`);
  }

  /**
   * Create plugin options by merging defaults with user-provided options Uses the
   * TOptions generic from the class to ensure type safety
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
 * Factory function to create a Zephyr plugin instance This simplifies the creation of
 * plugins with proper typing
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
