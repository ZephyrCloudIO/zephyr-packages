import type { Compiler } from '@rspack/core';
import {
  buildAssetsMap,
  zeBuildDashData,
  ZeErrors,
  ZephyrEngine,
  ZephyrError,
  type ZeBuildAssetsMap,
} from 'zephyr-agent';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import type { ZephyrMCPPluginOptions } from './types';

// Functional helpers for asset processing
function createAssetExtractor() {
  return (asset: { source: () => Buffer | string }): Buffer | string | undefined => {
    const content = asset.source();
    return Buffer.isBuffer(content) ? content : Buffer.from(content);
  };
}

function createAssetTypeExtractor() {
  return (asset: { constructor: { name?: string } }): string => {
    return asset.constructor.name || 'unknown';
  };
}

// Helper for build stats customization
function customizeBuildStatsForMCP(
  buildStats: ZephyrBuildStats,
  mcpOptions?: ZephyrMCPPluginOptions
): ZephyrBuildStats {
  buildStats.build_target = 'mcp';

  // Use MCP version from options or fallback to default
  buildStats.mcp_version = mcpOptions?.mcpVersion || '2024-11-05';

  if (mcpOptions?.mcpMetadata) {
    buildStats.mcp_capabilities = mcpOptions.mcpMetadata.capabilities;
    buildStats.mcp_metadata = {
      name: mcpOptions.mcpMetadata['name'] as string | undefined,
      description: mcpOptions.mcpMetadata['description'] as string | undefined,
      author: mcpOptions.mcpMetadata['author'] as string | undefined,
      homepage: mcpOptions.mcpMetadata['homepage'] as string | undefined,
      documentation: mcpOptions.mcpMetadata['documentation'] as string | undefined,
      ...mcpOptions.mcpMetadata,
    };
  }

  return buildStats;
}

export class ZeMCPPlugin {
  private zephyrEngine: ZephyrEngine | null = null;
  private readonly mcpOptions: ZephyrMCPPluginOptions;

  constructor(options: ZephyrMCPPluginOptions = {}) {
    this.mcpOptions = options;
  }

  apply(compiler: Compiler): void {
    const pluginName = 'ZeMCPPlugin';

    // Initialize ZephyrEngine during compilation
    compiler.hooks.beforeCompile.tapAsync(pluginName, (_, callback): void => {
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
          callback(
            new ZephyrError(ZeErrors.ERR_INITIALIZE_ZEPHYR_AGENT, { cause: error })
          );
        }
      })();
    });

    // Handle build completion
    compiler.hooks.afterEmit.tapAsync(pluginName, (compilation, callback): void => {
      if (!this.zephyrEngine) {
        callback(new ZephyrError(ZeErrors.ERR_INITIALIZE_ZEPHYR_AGENT));
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
          callback(
            new ZephyrError(ZeErrors.ERR_INITIALIZE_ZEPHYR_AGENT, { cause: error })
          );
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

  private async generateBuildStats(): Promise<ZephyrBuildStats> {
    if (!this.zephyrEngine) {
      throw new ZephyrError(ZeErrors.ERR_INITIALIZE_ZEPHYR_AGENT);
    }

    const buildStats = await zeBuildDashData(this.zephyrEngine);
    return customizeBuildStatsForMCP(buildStats, this.mcpOptions);
  }

  private async uploadAndFinalize(
    assetsMap: ZeBuildAssetsMap,
    buildStats: ZephyrBuildStats
  ): Promise<void> {
    if (!this.zephyrEngine) {
      throw new ZephyrError(ZeErrors.ERR_INITIALIZE_ZEPHYR_AGENT);
    }

    await this.zephyrEngine.upload_assets({
      assetsMap,
      buildStats,
      mfConfig: undefined,
    });

    await this.zephyrEngine.build_finished();
  }
}
