import type { Compiler as RspackCompiler } from '@rspack/core';
import type { Compiler as WebpackCompiler } from 'webpack';
import { ZeErrors, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import {
  detectAndStoreBaseHref,
  logBuildSteps,
  setupZeDeploy,
} from 'zephyr-xpack-internal';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import type { ZephyrMCPPluginOptions } from './types';

const PLUGIN_NAME = 'ZeMCPPlugin';

/** Internal plugin options used during compilation */
export interface ZephyrMCPInternalPluginOptions {
  zephyr_engine: ZephyrEngine;
  pluginName: string;
  mfConfig?: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];
  mcpOptions: ZephyrMCPPluginOptions;
  wait_for_index_html: boolean;
}

/**
 * Zephyr MCP Plugin for webpack/rspack Handles bundling and deployment of MCP servers to
 * Zephyr Cloud
 */
export class ZeMCPPlugin {
  private _options: ZephyrMCPInternalPluginOptions | null = null;
  private readonly mcpOptions: ZephyrMCPPluginOptions;

  constructor(options: ZephyrMCPPluginOptions) {
    this.validateOptions(options);
    this.mcpOptions = options;
  }

  /** Validates required MCP plugin options */
  private validateOptions(options: ZephyrMCPPluginOptions): void {
    const errors: string[] = [];

    if (!options.mcpVersion) {
      errors.push('mcpVersion is required');
    }

    if (!options.mcpMetadata) {
      errors.push('mcpMetadata is required');
    } else {
      if (!options.mcpMetadata.description) {
        errors.push('mcpMetadata.description is required');
      }
      if (!options.mcpMetadata.capabilities) {
        errors.push('mcpMetadata.capabilities is required');
      }
    }

    if (errors.length > 0) {
      throw new ZephyrError(ZeErrors.ERR_INITIALIZE_ZEPHYR_AGENT, {
        cause: new Error(`MCP Plugin validation failed: ${errors.join(', ')}`),
      });
    }
  }

  /** Apply the plugin to webpack/rspack compiler */
  apply(compiler: RspackCompiler | WebpackCompiler): void {
    compiler.hooks.beforeCompile.tapAsync(PLUGIN_NAME, (_, callback): void => {
      this.initializeZephyrEngine(compiler)
        .then(() => callback())
        .catch((error) => {
          callback(
            new ZephyrError(ZeErrors.ERR_INITIALIZE_ZEPHYR_AGENT, { cause: error })
          );
        });
    });
  }

  /** Detect the builder type from the compiler instance */
  private detectBuilder(
    compiler: RspackCompiler | WebpackCompiler
  ): 'webpack' | 'rspack' {
    // Check for rspack-specific properties or constructor name
    if (
      'builtins' in compiler.options ||
      (compiler.constructor.name === 'Compiler' && 'rspack' in compiler)
    ) {
      return 'rspack';
    }
    // Default to webpack
    return 'webpack';
  }

  /** Initialize ZephyrEngine and configure for MCP deployment */
  private async initializeZephyrEngine(
    compiler: RspackCompiler | WebpackCompiler
  ): Promise<void> {
    const builder = this.detectBuilder(compiler);

    const zephyrEngine = await ZephyrEngine.create({
      context: compiler.context,
      builder,
    });

    // Configure for MCP target
    zephyrEngine.env.target = 'mcp';

    // Set MCP-specific configuration
    zephyrEngine.setMCPConfiguration({
      version: this.mcpOptions.mcpVersion,
      capabilities: this.mcpOptions.mcpMetadata.capabilities,
      metadata: this.mcpOptions.mcpMetadata as Record<string, unknown>,
    });

    // Store internal options
    this._options = {
      zephyr_engine: zephyrEngine,
      pluginName: PLUGIN_NAME,
      mfConfig: this.mcpOptions.mfConfig,
      mcpOptions: this.mcpOptions,
      wait_for_index_html: false,
    };

    // Configure build properties
    this._options.zephyr_engine.buildProperties.output = compiler.outputPath;

    // Setup Zephyr deployment pipeline
    detectAndStoreBaseHref(this._options.zephyr_engine, compiler);
    logBuildSteps(this._options, compiler);
    setupZeDeploy(this._options, compiler);
  }
}
