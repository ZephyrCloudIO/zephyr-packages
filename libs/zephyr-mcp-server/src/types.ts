import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

export interface ZephyrHostConfig {
  /**
   * Zephyr API key for accessing hosted MCP servers
   */
  apiKey?: string;
  
  /**
   * Zephyr environment
   */
  environment?: 'production' | 'staging' | 'dev';
  
  /**
   * Zephyr Cloud base URL
   */
  cloudUrl?: string;
  
  /**
   * Filter for specific MCP servers (leave empty to load all)
   */
  allowedServers?: string[];
  
  /**
   * Cache configuration
   */
  cache?: {
    enabled: boolean;
    ttl: number;
  };
  
  /**
   * Sandbox configuration
   */
  sandbox?: {
    enabled: boolean;
    memoryLimit?: number;
    timeout?: number;
  };
}

export interface MCPServerEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  bundleUrl: string;
  metadata: {
    author?: string;
    homepage?: string;
    documentation?: string;
    capabilities?: {
      tools?: string[];
      resources?: string[];
      prompts?: string[];
    };
  };
  status: 'active' | 'inactive' | 'deprecated';
  createdAt: Date;
  updatedAt: Date;
}

export interface LoadedMCPServer {
  entry: MCPServerEntry;
  factory: () => Promise<Server>;
  instance?: Server;
}