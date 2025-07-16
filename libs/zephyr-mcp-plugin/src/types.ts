import type { moduleFederationPlugin } from '@module-federation/sdk';

export interface ZephyrMCPPluginOptions {
  /** Module Federation configuration for the MCP server */
  mfConfig?: moduleFederationPlugin.ModuleFederationPluginOptions;

  /** MCP server metadata for Zephyr (stored in snapshot metadata) */
  mcpMetadata?: {
    /** Server description */
    description?: string;

    /** Server author */
    author?: string;

    /** Homepage URL */
    homepage?: string;

    /** Documentation URL */
    documentation?: string;

    /** Server capabilities */
    capabilities?: {
      tools?: string[];
      resources?: string[];
      prompts?: string[];
    };

    /** Additional custom metadata */
    [key: string]: unknown;
  };
}
