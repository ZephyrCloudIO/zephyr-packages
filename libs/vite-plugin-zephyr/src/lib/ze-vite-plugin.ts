import type { Plugin, ResolvedConfig } from 'vite';
import { zeBuildDashData } from 'zephyr-agent';
import { ZeBasePlugin, ZeProcessAssetsResult } from 'zephyr-xpack-internal';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map';
import { extract_remotes_dependencies } from './internal/mf-vite-etl/extract-mf-vite-remotes';
import { load_resolved_remotes } from './internal/mf-vite-etl/load_resolved_remotes';
import { ZephyrViteInternalPluginOptions, ZephyrVitePluginOptions } from './types';
import { ZephyrInternalOptions } from './internal/types/zephyr-internal-options';

const PLUGIN_NAME = 'ze-vite-plugin';

/** Vite plugin implementation that extends the base Zephyr plugin */
export class ZeVitePlugin extends ZeBasePlugin<
  ZephyrVitePluginOptions,
  ZephyrViteInternalPluginOptions
> {
  private viteOptions?: ZephyrInternalOptions;
  private resolveViteOptions?: (options: ZephyrInternalOptions) => void;
  private viteOptionsPromise: Promise<ZephyrInternalOptions>;

  /**
   * Create a new ZeVitePlugin instance
   *
   * @param options - Internal plugin options
   */
  constructor(options: Omit<ZephyrViteInternalPluginOptions, 'pluginName'>) {
    super(
      {
        ...options,
        pluginName: PLUGIN_NAME,
      },
      'vite'
    );

    // Setup promise for vite options that will be resolved during configResolved hook
    this.viteOptionsPromise = new Promise<ZephyrInternalOptions>((resolve) => {
      this.resolveViteOptions = resolve;
    });
  }

  /**
   * Get the Vite plugin instance
   *
   * @returns A Vite plugin configuration
   */
  getVitePlugin(): Plugin {
    return {
      name: this.pluginName,
      enforce: 'post', // Ensure this plugin runs after other plugins

      configResolved: async (config: ResolvedConfig) => {
        await this.onConfigResolved(config);
      },

      transform: async (code: string, id: string) => {
        return this.onTransform(code, id);
      },

      closeBundle: async () => {
        await this.onCloseBundle();
      },
    };
  }

  /**
   * Handle the configResolved hook
   *
   * @param config - Vite's resolved configuration
   */
  private async onConfigResolved(config: ResolvedConfig): Promise<void> {
    this.options.root = config.root;

    // Initialize the plugin
    await this.initialize();

    // Resolve the vite options for use in other hooks
    if (this.resolveViteOptions) {
      this.resolveViteOptions({
        root: config.root,
        outDir: config.build?.outDir,
        publicDir: config.publicDir,
      });
    }

    this.log(`Initialized with root directory: ${config.root}`);
  }

  /**
   * Handle the transform hook
   *
   * @param code - The source code
   * @param id - The module ID/path
   * @returns Transformed code or null if no transformation needed
   */
  private async onTransform(code: string, id: string): Promise<string | null> {
    if (!this.options.root) {
      this.logWarning('Root directory not set, skipping transform');
      return code;
    }

    try {
      const zephyr_engine = this.options.zephyr_engine;

      // Extract any module federation dependencies
      const dependencyPairs = extract_remotes_dependencies(this.options.root, code, id);
      if (!dependencyPairs) return code;

      // Resolve the remote dependencies
      const resolved_remotes =
        await zephyr_engine.resolve_remote_dependencies(dependencyPairs);
      if (!resolved_remotes) return code;

      // Load the resolved remotes
      const transformedCode = load_resolved_remotes(resolved_remotes, code, id);
      return transformedCode !== undefined ? transformedCode : code;
    } catch (error) {
      this.logError(
        `Error transforming module ${id}: ${error instanceof Error ? error.message : String(error)}`
      );
      return code; // Return original code on error
    }
  }

  /** Handle the closeBundle hook - called when the bundle is complete */
  private async onCloseBundle(): Promise<void> {
    this.log('Bundle complete, processing assets...');

    try {
      // Process and upload the assets
      const result = await this.processAssets();

      if (!result.success) {
        this.logError(`Failed to process assets: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      this.logError(
        `Error in closeBundle: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Process the bundle assets This is the main implementation of the abstract method from
   * ZeBasePlugin
   */
  protected async processAssets(): Promise<ZeProcessAssetsResult> {
    try {
      // Wait for the vite options to be available
      const viteOptions = await this.viteOptionsPromise;

      if (!viteOptions) {
        return {
          success: false,
          error: 'Vite options not available',
        };
      }

      const zephyr_engine = this.options.zephyr_engine;
      await zephyr_engine.start_new_build();

      const assetsMap = await extract_vite_assets_map(zephyr_engine, viteOptions);

      await zephyr_engine.upload_assets({
        assetsMap,
        buildStats: await zeBuildDashData(zephyr_engine),
      });

      await zephyr_engine.build_finished();

      this.log('Successfully processed and uploaded assets');
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
