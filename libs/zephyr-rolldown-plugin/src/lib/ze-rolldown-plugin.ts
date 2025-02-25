import type {
  InputOptions,
  NormalizedOutputOptions,
  OutputBundle,
  Plugin,
} from 'rolldown';
import { zeBuildDashData } from 'zephyr-agent';
import { ZeBasePlugin, ZeProcessAssetsResult } from 'zephyr-xpack-internal';
import { getAssetsMap } from './internal/get-assets-map';
import {
  ZephyrRolldownInternalPluginOptions,
  ZephyrRolldownPluginOptions,
} from './types';
import { cwd } from 'node:process';

const PLUGIN_NAME = 'ze-rolldown-plugin';

/**
 * Helper function to determine the input folder from Rolldown options
 *
 * @param options - Rolldown input options
 * @returns The input folder path
 */
const getInputFolder = (options: InputOptions): string => {
  if (typeof options.input === 'string') return options.input;
  if (Array.isArray(options.input)) return options.input[0];
  if (typeof options.input === 'object') return Object.values(options.input)[0];
  return cwd();
};

/** Rolldown plugin implementation that extends the base Zephyr plugin */
export class ZeRolldownPlugin extends ZeBasePlugin<
  ZephyrRolldownPluginOptions,
  ZephyrRolldownInternalPluginOptions
> {
  private bundle: OutputBundle | null = null;
  private outputOptions: NormalizedOutputOptions | null = null;

  /**
   * Create a new ZeRolldownPlugin instance
   *
   * @param options - Internal plugin options
   */
  constructor(options: Omit<ZephyrRolldownInternalPluginOptions, 'pluginName'>) {
    super(
      {
        ...options,
        pluginName: PLUGIN_NAME,
      },
      'rollup' // Using rollup as the bundler type since they share the same API
    );
  }

  /** Get the Rolldown plugin instance This is the main entry point that Rolldown will use */
  getRolldownPlugin(): Plugin {
    return {
      name: this.pluginName,

      // Called at the start of the build
      buildStart: async (options: InputOptions) => {
        await this.onBuildStart(options);
      },

      // Called when all bundles have been written to disk
      writeBundle: async (options: NormalizedOutputOptions, bundle: OutputBundle) => {
        this.outputOptions = options;
        this.bundle = bundle;
        await this.onWriteBundle();
      },
    };
  }

  /**
   * Handle the buildStart hook
   *
   * @param options - Rolldown input options
   */
  private async onBuildStart(options: InputOptions): Promise<void> {
    await this.initialize();
    const path_to_execution_dir = getInputFolder(options);
    this.log(`Build started with input from: ${path_to_execution_dir}`);
  }

  /** Handle the writeBundle hook */
  private async onWriteBundle(): Promise<void> {
    this.log('Processing bundle output');
    if (!this.bundle) {
      this.logError('No bundle available to process');
      return;
    }

    try {
      const result = await this.processAssets();
      if (!result.success) {
        this.logError(`Failed to process assets: ${result.error}`);
      }
    } catch (error) {
      this.logError(
        `Error in writeBundle: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /** Process the bundle assets This is called by the writeBundle hook */
  protected async processAssets(): Promise<ZeProcessAssetsResult> {
    try {
      this.log('Processing bundle assets');

      if (!this.bundle) {
        return {
          success: false,
          error: 'No bundle available to process',
        };
      }

      const zephyr_engine = this.options.zephyr_engine;

      try {
        // Make sure we have a snapshot ID for upload_assets
        if (typeof zephyr_engine.start_new_build === 'function') {
          await zephyr_engine.start_new_build();
        }

        // Only call upload_assets if it exists as a function
        if (typeof zephyr_engine.upload_assets === 'function') {
          await zephyr_engine.upload_assets({
            assetsMap: getAssetsMap(this.bundle),
            buildStats: await zeBuildDashData(zephyr_engine),
          });
        } else {
          this.logError('upload_assets method is not available on the zephyr_engine');
          return {
            success: false,
            error: 'upload_assets method is not available',
          };
        }
      } catch (error) {
        this.logError(
          `Upload assets error: ${error instanceof Error ? error.message : String(error)}`
        );
        // Even if upload fails, try to finish the build
      }

      // Safely call build_finished if it exists
      if (typeof zephyr_engine.build_finished === 'function') {
        await zephyr_engine.build_finished();
      }

      this.log('Successfully processed bundle assets');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
