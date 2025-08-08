import type { ZephyrPluginOptions } from 'zephyr-edge-contract';

/** MCP server capabilities configuration */
export interface MCPCapabilities {
  /** List of tools exposed by the MCP server */
  tools?: string[];
  /** List of resources provided by the MCP server */
  resources?: string[];
  /** List of prompts supported by the MCP server */
  prompts?: string[];
  /** Allow additional properties for extensibility */
  [key: string]: unknown;
}

/** MCP server metadata configuration */
export interface MCPMetadata {
  /** Server description (required) */
  description: string;
  /** Server author */
  author?: string;
  /** Homepage URL */
  homepage?: string;
  /** Documentation URL */
  documentation?: string;
  /** Server capabilities (required) */
  capabilities: MCPCapabilities;
  /** Additional custom metadata */
  [key: string]: unknown;
}

/** Configuration options for the Zephyr MCP Plugin */
export interface ZephyrMCPPluginOptions {
  /** Module Federation configuration for the MCP server */
  mfConfig?: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];
  /** MCP protocol version (required) */
  mcpVersion: string;
  /** MCP server metadata (required) */
  mcpMetadata: MCPMetadata;
}
