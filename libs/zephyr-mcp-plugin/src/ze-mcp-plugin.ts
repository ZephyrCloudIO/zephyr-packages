import type { Compiler } from '@rspack/core';
import {
  ZephyrEngine,
  buildAssetsMap,
  zeBuildDashData,
  type ZeBuildAssetsMap,
} from 'zephyr-agent';
import type { ZephyrMCPPluginOptions } from './types';

// Functional helpers for asset processing
const createAssetExtractor =
  () =>
  (asset: any): Buffer | string | undefined => {
    const content = asset.source();
    return Buffer.isBuffer(content) ? content : Buffer.from(content);
  };

const createAssetTypeExtractor =
  () =>
  (asset: any): string => {
    return asset.constructor.name || 'unknown';
  };

// Functional helper for build stats customization
const customizeBuildStatsForMCP = (
  buildStats: any,
  mcpMetadata?: ZephyrMCPPluginOptions['mcpMetadata']
) => {
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
    compiler.hooks.beforeCompile.tapAsync(pluginName, async (params, callback) => {
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
        callback(error as Error);
      }
    });

    // Handle build completion
    compiler.hooks.afterEmit.tapAsync(pluginName, async (compilation, callback) => {
      if (!this.zephyrEngine) {
        callback(new Error('ZephyrEngine not initialized'));
        return;
      }

      try {
        // Process assets using functional approach
        const assetsMap = await this.processAssets(compilation.assets);

        // Generate and customize build stats
        const buildStats = await this.generateBuildStats();

        // Upload and finalize
        await this.uploadAndFinalize(assetsMap, buildStats);

        callback();
      } catch (error) {
        callback(error as Error);
      }
    });
  }

  private async processAssets(
    compilationAssets: Record<string, any>
  ): Promise<ZeBuildAssetsMap> {
    const extractBuffer = createAssetExtractor();
    const getAssetType = createAssetTypeExtractor();

    return buildAssetsMap(compilationAssets, extractBuffer, getAssetType);
  }

  private async generateBuildStats() {
    if (!this.zephyrEngine) {
      throw new Error('ZephyrEngine not initialized');
    }

    const buildStats = await zeBuildDashData(this.zephyrEngine);
    return customizeBuildStatsForMCP(buildStats, this.mcpMetadata);
  }

  private async uploadAndFinalize(
    assetsMap: ZeBuildAssetsMap,
    buildStats: any
  ): Promise<void> {
    if (!this.zephyrEngine) {
      throw new Error('ZephyrEngine not initialized');
    }

    await this.zephyrEngine.upload_assets({
      assetsMap,
      buildStats,
      mfConfig: undefined,
    });

    await this.zephyrEngine.build_finished();
  }
}
