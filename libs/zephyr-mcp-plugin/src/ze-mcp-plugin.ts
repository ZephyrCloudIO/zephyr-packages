import type { Compiler as RspackCompiler } from '@rspack/core';
import type { Compiler as WebpackCompiler } from 'webpack';
import { ZeErrors, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import {
  detectAndStoreBaseHref,
  logBuildSteps,
  setupZeDeploy,
} from 'zephyr-xpack-internal';
import type { ZephyrMCPPluginOptions } from './types';

const pluginName = 'ZeMCPPlugin';

export interface ZephyrMCPInternalPluginOptions {
  zephyr_engine: ZephyrEngine;
  // plugin name
  pluginName: string;
  // federated module config
  mfConfig: any;
  // MCP specific options
  mcpOptions: ZephyrMCPPluginOptions;
  // hacks
  wait_for_index_html?: boolean;
}

export class ZeMCPPlugin {
  private _options: ZephyrMCPInternalPluginOptions | null = null;
  private readonly mcpOptions: ZephyrMCPPluginOptions;

  constructor(options: ZephyrMCPPluginOptions) {
    if (!options.mcpVersion) {
      throw new ZephyrError(ZeErrors.ERR_INITIALIZE_ZEPHYR_AGENT);
    }
    if (!options.mcpMetadata) {
      throw new ZephyrError(ZeErrors.ERR_INITIALIZE_ZEPHYR_AGENT);
    }
    if (!options.mcpMetadata.description) {
      throw new ZephyrError(ZeErrors.ERR_INITIALIZE_ZEPHYR_AGENT);
    }
    if (!options.mcpMetadata.capabilities) {
      throw new ZephyrError(ZeErrors.ERR_INITIALIZE_ZEPHYR_AGENT);
    }

    this.mcpOptions = options;
  }

  apply(compiler: RspackCompiler | WebpackCompiler): void {
    // Initialize ZephyrEngine during compilation
    compiler.hooks.beforeCompile.tapAsync(pluginName, (_, callback): void => {
      void (async (): Promise<void> => {
        try {
          const zephyrEngine = await ZephyrEngine.create({
            context: compiler.context,
            builder: 'webpack', // Since this is for webpack/rspack compatibility
          });

          // Set platform to 'mcp' for MCP servers
          zephyrEngine.env.target = 'mcp';

          // Configure MCP metadata (required)
          zephyrEngine.setMCPConfiguration({
            version: this.mcpOptions.mcpVersion,
            capabilities: this.mcpOptions.mcpMetadata.capabilities,
            metadata: this.mcpOptions.mcpMetadata,
          });

          this._options = {
            zephyr_engine: zephyrEngine,
            pluginName,
            mfConfig: this.mcpOptions.mfConfig,
            mcpOptions: this.mcpOptions,
            wait_for_index_html: false,
          };

          // Use the same setup as rspack plugin
          this._options.zephyr_engine.buildProperties.output = compiler.outputPath;
          detectAndStoreBaseHref(this._options.zephyr_engine, compiler);
          logBuildSteps(this._options, compiler);
          setupZeDeploy(this._options, compiler);

          callback();
        } catch (error) {
          callback(
            new ZephyrError(ZeErrors.ERR_INITIALIZE_ZEPHYR_AGENT, { cause: error })
          );
        }
      })();
    });
  }
}
