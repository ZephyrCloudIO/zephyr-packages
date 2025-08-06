import type { ZephyrPluginOptions } from 'zephyr-edge-contract';

export interface ZephyrMCPPluginOptions {
  /** Module Federation configuration for the MCP server */
  mfConfig?: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];

  /** MCP protocol version (import from '@modelcontextprotocol/sdk/types.js') - REQUIRED */
  mcpVersion: string;

  /** MCP server metadata for Zephyr (stored in snapshot metadata) - REQUIRED */
  mcpMetadata: {
    /** Server description - REQUIRED */
    description: string;

    /** Server author */
    author?: string;

    /** Homepage URL */
    homepage?: string;

    /** Documentation URL */
    documentation?: string;

    /** Server capabilities - REQUIRED */
    capabilities: {
      tools?: string[];
      resources?: string[];
      prompts?: string[];
    };

    /** Additional custom metadata */
    [key: string]: unknown;
  };
}
