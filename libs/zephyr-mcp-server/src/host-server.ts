import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import {
  CallToolRequestSchema,
  CallToolResultSchema,
  GetPromptRequestSchema,
  GetPromptResultSchema,
  ListPromptsRequestSchema,
  ListPromptsResultSchema,
  ListResourcesRequestSchema,
  ListResourcesResultSchema,
  ListToolsRequestSchema,
  ListToolsResultSchema,
  ReadResourceRequestSchema,
  ReadResourceResultSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ModuleFederationLoader } from './module-federation-loader';
import { MCPRegistry } from './registry';
import type { LoadedMCPServer, MCPServerEntry, ZephyrHostConfig } from './types';
import { logger } from './logger';

export class ZephyrHostMCPServer {
  private server: Server;
  private config: ZephyrHostConfig;
  private registry: MCPRegistry;
  private loadedServers: Map<string, LoadedMCPServer> = new Map();
  private moduleLoader: ModuleFederationLoader;

  constructor(config: ZephyrHostConfig = {}) {
    this.config = {
      environment: 'production',
      cloudUrl: config.cloudUrl || 'https://cdn.zephyr-cloud.io',
      cache: { enabled: true, ttl: 3600000 }, // 1 hour
      sandbox: { enabled: true },
      ...config,
    };

    this.server = new Server(
      {
        name: 'zephyr-mcp-host',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );

    this.registry = new MCPRegistry();
    this.moduleLoader = new ModuleFederationLoader();
  }

  async initialize(): Promise<void> {
    // Discover available MCP servers
    await this.discoverServers();

    // Load approved servers
    await this.loadServers();

    // Set up request handlers
    this.setupRequestHandlers();
  }

  private async discoverServers(): Promise<void> {
    logger.log('Discovering MCP servers...');

    try {
      const allServers: MCPServerEntry[] = [];

      // Process direct MCP URLs if provided
      if (this.config.mcpUrls && this.config.mcpUrls.length > 0) {
        logger.log(
          `Loading ${this.config.mcpUrls.length} MCP servers from provided URLs...`
        );

        const directServers = await this.processDirectUrls(this.config.mcpUrls);
        allServers.push(...directServers);
      }

      // Process cloud URLs (manifests) if provided
      if (this.config.cloudUrls && this.config.cloudUrls.length > 0) {
        logger.log(
          `Loading ${this.config.cloudUrls.length} manifest(s) from cloud URLs...`
        );

        const manifestServers = await this.processManifestUrls(this.config.cloudUrls);
        allServers.push(...manifestServers);
      }

      // Backward compatibility: single cloudUrl
      if (this.config.cloudUrl && !this.config.cloudUrls) {
        logger.log(`Loading manifest from: ${this.config.cloudUrl}`);
        const manifestServers = await this.processManifestUrls([this.config.cloudUrl]);
        allServers.push(...manifestServers);
      }

      if (allServers.length === 0) {
        logger.log('No MCP URLs or manifest URLs provided.');
        return;
      }

      // Deduplicate servers by name and register them
      const uniqueServers = this.deduplicateServers(allServers);

      for (const server of uniqueServers) {
        // Filter by allowed servers if specified
        if (
          this.config.allowedServers &&
          !this.config.allowedServers.includes(server.name)
        ) {
          continue;
        }

        this.registry.register(server);
      }

      logger.log(`✓ Found ${this.registry.size()} MCP servers after deduplication`);
    } catch (error) {
      logger.error('Failed to discover servers:', error);
      throw error;
    }
  }

  private async processDirectUrls(urls: string[]): Promise<MCPServerEntry[]> {
    const servers: MCPServerEntry[] = [];

    for (const url of urls) {
      try {
        const entry = this.createServerEntryFromUrl(url);
        servers.push(entry);
        logger.log(`✓ Created entry for ${entry.name} from ${url}`);
      } catch (error) {
        logger.error(`Failed to process URL ${url}:`, error);
      }
    }

    return servers;
  }

  private async processManifestUrls(urls: string[]): Promise<MCPServerEntry[]> {
    const servers: MCPServerEntry[] = [];

    // Process manifests in parallel for better performance
    const manifestPromises = urls.map((url) => this.processManifestUrl(url));
    const results = await Promise.allSettled(manifestPromises);

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const url = urls[i];

      if (result.status === 'fulfilled') {
        servers.push(...result.value);
        logger.log(`✓ Loaded ${result.value.length} server(s) from ${url}`);
      } else {
        logger.error(`Failed to load manifest from ${url}:`, result.reason);
      }
    }

    return servers;
  }

  private async processManifestUrl(url: string): Promise<MCPServerEntry[]> {
    const response = await fetch(url, {
      headers: this.config.apiKey
        ? {
            Authorization: `Bearer ${this.config.apiKey}`,
          }
        : {},
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.statusText}`);
    }

    const manifest = await response.json();

    // Check if this is a Module Federation manifest
    if (manifest.id && manifest.metaData) {
      logger.log('Detected Module Federation manifest');
      logger.log(`ID: ${manifest.id}, Name: ${manifest.name}`);

      const baseUrl = url.replace('/mf-manifest.json', '');
      const server: MCPServerEntry = {
        id: manifest.id,
        name: this.ensureUniqueName(manifest.name, url),
        version: manifest.metaData.buildInfo?.buildVersion || '1.0.0',
        description: `Module Federation remote: ${manifest.name}`,
        bundleUrl: `${baseUrl}/remoteEntry.js`,
        metadata: {
          mfManifest: manifest,
          sourceUrl: url,
          capabilities: {},
        },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return [server];
    } else {
      // Legacy server list manifest
      const servers = manifest.servers || [];
      return servers.map((server: MCPServerEntry) => ({
        ...server,
        metadata: {
          ...server.metadata,
          sourceUrl: url,
        },
      }));
    }
  }

  private createServerEntryFromUrl(url: string): MCPServerEntry {
    const urlParts = new URL(url);
    const hostParts = urlParts.hostname.split('-');

    // Try to extract a meaningful name from the URL
    let serverName = 'mcp-server';
    if (hostParts.length > 4) {
      // Take parts that look like the actual name (github-tools-mcp)
      serverName = hostParts.slice(3, -3).join('-');
    }

    return {
      id: `${serverName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: this.ensureUniqueName(serverName, url),
      version: '1.0.0',
      description: `MCP server from ${urlParts.hostname}`,
      bundleUrl: url,
      metadata: {
        sourceUrl: url,
        capabilities: {},
      },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  private ensureUniqueName(baseName: string, sourceUrl: string): string {
    // Simple approach: if name conflicts, append URL hash
    const urlHash = sourceUrl.split('//')[1]?.split('.')[0] || 'unknown';
    return `${baseName}-${urlHash}`;
  }

  private deduplicateServers(servers: MCPServerEntry[]): MCPServerEntry[] {
    const seen = new Set<string>();
    const unique: MCPServerEntry[] = [];

    for (const server of servers) {
      if (!seen.has(server.name)) {
        seen.add(server.name);
        unique.push(server);
      } else {
        logger.log(`⚠️  Skipping duplicate server: ${server.name}`);
      }
    }

    return unique;
  }

  private async loadServers(): Promise<void> {
    logger.log('Loading MCP servers...');

    const entries = this.registry.getAll();

    for (const entry of entries) {
      try {
        logger.log(`Loading ${entry.name} v${entry.version}...`);

        const factory = await this.moduleLoader.loadMCPServer(entry);
        logger.log(`✓ Loaded ${entry.name} via Module Federation`);

        this.loadedServers.set(entry.name, {
          entry,
          factory,
        });
      } catch (error) {
        logger.error(`Failed to load ${entry.name}:`, error);
      }
    }
  }

  private async getServerClient(loaded: LoadedMCPServer): Promise<Client> {
    if (!loaded.client) {
      // First, get the server instance
      if (!loaded.instance) {
        const instance = await loaded.factory();
        // Check if the instance has a 'server' property (common pattern)
        if (instance && typeof instance === 'object' && 'server' in instance) {
          loaded.instance = (instance as Record<string, unknown>)['server'] as Server;
        } else {
          loaded.instance = instance;
        }
      }

      // Create a linked pair of transports for client-server communication
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

      // Create and connect the client
      loaded.client = new Client(
        {
          name: `${loaded.entry.name}-client`,
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect the server to one transport and client to the other
      await loaded.instance?.connect(serverTransport);
      await loaded.client.connect(clientTransport);

      logger.log(`✓ Connected client to ${loaded.entry.name}`);
    }
    return loaded.client;
  }

  private setupRequestHandlers(): void {
    // List all available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = [];

      for (const [serverName, loaded] of this.loadedServers) {
        try {
          // Get tools from server via client
          const client = await this.getServerClient(loaded);
          const response = await client.request(
            { method: 'tools/list', params: {} },
            ListToolsResultSchema
          );

          if (response.tools) {
            // Namespace tools
            for (const tool of response.tools) {
              allTools.push({
                ...tool,
                name: `${serverName}.${tool.name}`,
                description: `[${serverName}] ${tool.description || ''}`,
                metadata: {
                  ...(tool['metadata'] || {}),
                  server: serverName,
                  version: loaded.entry.version,
                },
              });
            }
          }
        } catch (error) {
          logger.error(`Failed to get tools from ${serverName}:`, error);
        }
      }

      return { tools: allTools };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Parse namespaced name
      const dotIndex = name.indexOf('.');
      if (dotIndex === -1) {
        throw new Error('Invalid tool name format. Use: server.tool');
      }

      const serverName = name.substring(0, dotIndex);
      const toolName = name.substring(dotIndex + 1);

      const loaded = this.loadedServers.get(serverName);
      if (!loaded) {
        throw new Error(`Server ${serverName} not found`);
      }

      try {
        // Call the tool via client
        const client = await this.getServerClient(loaded);
        const response = await client.request(
          {
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: args,
            },
          },
          CallToolResultSchema
        );

        return response;
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error calling ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });

    // Also handle resources and prompts
    this.setupResourceHandlers();
    this.setupPromptHandlers();
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const allResources = [];

      for (const [serverName, loaded] of this.loadedServers) {
        try {
          const client = await this.getServerClient(loaded);
          const response = await client.request(
            { method: 'resources/list', params: {} },
            ListResourcesResultSchema
          );

          if (response.resources) {
            for (const resource of response.resources) {
              allResources.push({
                ...resource,
                uri: `${serverName}:${resource.uri}`,
                metadata: {
                  ...(resource['metadata'] || {}),
                  server: serverName,
                },
              });
            }
          }
        } catch (error) {
          logger.error(`Failed to get resources from ${serverName}:`, error);
        }
      }

      return { resources: allResources };
    });

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      const colonIndex = uri.indexOf(':');
      if (colonIndex === -1) {
        throw new Error('Invalid resource URI format');
      }

      const serverName = uri.substring(0, colonIndex);
      const resourceUri = uri.substring(colonIndex + 1);

      const loaded = this.loadedServers.get(serverName);
      if (!loaded) {
        throw new Error(`Server ${serverName} not found`);
      }

      const client = await this.getServerClient(loaded);
      return client.request(
        {
          method: 'resources/read',
          params: { uri: resourceUri },
        },
        ReadResourceResultSchema
      );
    });
  }

  private setupPromptHandlers(): void {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const allPrompts = [];

      for (const [serverName, loaded] of this.loadedServers) {
        try {
          const client = await this.getServerClient(loaded);
          const response = await client.request(
            { method: 'prompts/list', params: {} },
            ListPromptsResultSchema
          );

          if (response.prompts) {
            for (const prompt of response.prompts) {
              allPrompts.push({
                ...prompt,
                name: `${serverName}.${prompt.name}`,
                metadata: {
                  ...(prompt['metadata'] || {}),
                  server: serverName,
                },
              });
            }
          }
        } catch (error) {
          logger.error(`Failed to get prompts from ${serverName}:`, error);
        }
      }

      return { prompts: allPrompts };
    });

    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const dotIndex = name.indexOf('.');
      if (dotIndex === -1) {
        throw new Error('Invalid prompt name format');
      }

      const serverName = name.substring(0, dotIndex);
      const promptName = name.substring(dotIndex + 1);

      const loaded = this.loadedServers.get(serverName);
      if (!loaded) {
        throw new Error(`Server ${serverName} not found`);
      }

      const client = await this.getServerClient(loaded);
      return client.request(
        {
          method: 'prompts/get',
          params: {
            name: promptName,
            arguments: args,
          },
        },
        GetPromptResultSchema
      );
    });
  }

  getServer(): Server {
    return this.server;
  }

  async connect(_stdin: NodeJS.ReadStream, _stdout: NodeJS.WriteStream): Promise<void> {
    // Connect using stdio transport
    const { StdioServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/stdio.js'
    );
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    // Close all client connections
    for (const [serverName, loaded] of this.loadedServers) {
      if (loaded.client) {
        try {
          await loaded.client.close();
          logger.log(`✓ Closed client connection to ${serverName}`);
        } catch (error) {
          logger.error(`Failed to close client for ${serverName}:`, error);
        }
      }
    }

    // Clear loaded servers
    this.loadedServers.clear();

    // Close the host server if connected
    try {
      await this.server.close();
      logger.log('✓ Host server closed');
    } catch (error) {
      logger.error('Failed to close host server:', error);
    }
  }
}

export async function createZephyrHostServer(
  config?: ZephyrHostConfig
): Promise<ZephyrHostMCPServer> {
  const host = new ZephyrHostMCPServer(config);
  await host.initialize();
  return host;
}
