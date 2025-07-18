import type { Compiler } from '@rspack/core';
import {
  ZephyrEngine,
  buildAssetsMap,
  zeBuildDashData,
  ZephyrError,
  type ZeBuildAssetsMap,
} from 'zephyr-agent';
import type { ZephyrMCPPluginOptions } from './types';

// Functional helpers for asset processing
const createAssetExtractor =
  () =>
  (asset: { source: () => Buffer | string }): Buffer | string | undefined => {
    const content = asset.source();
    return Buffer.isBuffer(content) ? content : Buffer.from(content);
  };

const createAssetTypeExtractor =
  () =>
  (asset: { constructor: { name?: string } }): string => {
    return asset.constructor.name || 'unknown';
  };

// Functional helper for build stats customization
const customizeBuildStatsForMCP = (
  buildStats: Record<string, unknown>,
  mcpMetadata?: ZephyrMCPPluginOptions['mcpMetadata']
): Record<string, unknown> => {
  buildStats.build_target = 'mcp';

  // Add MCP metadata to snapshot if provided
  if (mcpMetadata) {
    buildStats.snapshot = {
      ...buildStats.snapshot,
      metadata: {
        ...buildStats.snapshot?.metadata,
        platform: 'mcp',
        ...mcpMetadata,
      },
    };
  }

  return buildStats;
};

export class ZeMCPPlugin {
  private zephyrEngine: ZephyrEngine | null = null;
  private readonly mcpMetadata: ZephyrMCPPluginOptions['mcpMetadata'];

  constructor(options: ZephyrMCPPluginOptions = {}) {
    this.mcpMetadata = options.mcpMetadata;
  }

  apply(compiler: Compiler): void {
    const pluginName = 'ZeMCPPlugin';

    // Initialize ZephyrEngine during compilation
    compiler.hooks.beforeCompile.tapAsync(pluginName, (params, callback): void => {
      void (async (): Promise<void> => {
        try {
          this.zephyrEngine = await ZephyrEngine.create({
            context: compiler.context,
            builder: 'rspack',
          });

          // Set platform to 'mcp' for MCP servers
          this.zephyrEngine.env.target = 'mcp';

          // Start new build
          await this.zephyrEngine.start_new_build();

          callback();
        } catch (error) {
          callback(ZephyrError.from(error));
        }
      })();
    });

    // Handle build completion
    compiler.hooks.afterEmit.tapAsync(pluginName, (compilation, callback): void => {
      if (!this.zephyrEngine) {
        callback(new ZephyrError('ZephyrEngine not initialized'));
        return;
      }

      void (async (): Promise<void> => {
        try {
          // Process assets using functional approach
          const assetsMap = await this.processAssets(compilation.assets);

          // Generate and customize build stats
          const buildStats = await this.generateBuildStats();

          // Upload and finalize
          await this.uploadAndFinalize(assetsMap, buildStats);

          callback();
        } catch (error) {
          callback(ZephyrError.from(error));
        }
      })();
    });
  }

  private async processAssets(
    compilationAssets: Record<
      string,
      { source: () => Buffer | string; constructor: { name?: string } }
    >
  ): Promise<ZeBuildAssetsMap> {
    const extractBuffer = createAssetExtractor();
    const getAssetType = createAssetTypeExtractor();

    return buildAssetsMap(compilationAssets, extractBuffer, getAssetType);
  }

  private async generateBuildStats(): Promise<Record<string, unknown>> {
    if (!this.zephyrEngine) {
      throw new ZephyrError('ZephyrEngine not initialized');
    }

    const buildStats = await zeBuildDashData(this.zephyrEngine);
    return customizeBuildStatsForMCP(buildStats, this.mcpMetadata);
  }

  private async uploadAndFinalize(
    assetsMap: ZeBuildAssetsMap,
    buildStats: Record<string, unknown>
  ): Promise<void> {
    if (!this.zephyrEngine) {
      throw new ZephyrError('ZephyrEngine not initialized');
    }

    await this.zephyrEngine.upload_assets({
      assetsMap,
      buildStats,
      mfConfig: undefined,
    });

    await this.zephyrEngine.build_finished();
  }
}
