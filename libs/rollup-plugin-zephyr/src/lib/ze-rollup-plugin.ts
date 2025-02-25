import type { InputOptions, NormalizedOutputOptions, OutputBundle, Plugin } from 'rollup';
import { zeBuildDashData } from 'zephyr-agent';
import { ZeBasePlugin, ZeProcessAssetsResult } from 'zephyr-xpack-internal';
import { getAssetsMap } from './transform/get-assets-map';
import { ZephyrRollupInternalPluginOptions, ZephyrRollupPluginOptions } from './types';
import { cwd } from 'node:process';

const PLUGIN_NAME = 'ze-rollup-plugin';

/**
 * Helper function to determine the input folder from Rollup options
 *
 * @param options - Rollup input options
 * @returns The input folder path
 */
const getInputFolder = (options: InputOptions): string => {
  if (typeof options.input === 'string') return options.input;
  if (Array.isArray(options.input)) return options.input[0];
  if (typeof options.input === 'object') return Object.values(options.input)[0];
  return cwd();
};

/** Rollup plugin implementation that extends the base Zephyr plugin */
export class ZeRollupPlugin extends ZeBasePlugin<
  ZephyrRollupPluginOptions,
  ZephyrRollupInternalPluginOptions
> {
  private bundle: OutputBundle | null = null;
  private outputOptions: NormalizedOutputOptions | null = null;

  /**
   * Create a new ZeRollupPlugin instance
   *
   * @param options - Internal plugin options
   */
  constructor(options: Omit<ZephyrRollupInternalPluginOptions, 'pluginName'>) {
    super(
      {
        ...options,
        pluginName: PLUGIN_NAME,
      },
      'rollup'
    );
  }

  /** Get the Rollup plugin instance This is the main entry point that Rollup will use */
  getRollupPlugin(): Plugin {
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
   * @param options - Rollup input options
   */
  private async onBuildStart(options: InputOptions): Promise<void> {
    await this.initialize();
    const path_to_execution_dir = getInputFolder(options);

    // We don't need to update the zephyr engine context here
    // as it's handled in the withZephyr factory function

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
      await zephyr_engine.start_new_build();

      await zephyr_engine.upload_assets({
        assetsMap: getAssetsMap(this.bundle),
        buildStats: await zeBuildDashData(zephyr_engine),
      });

      await zephyr_engine.build_finished();

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
