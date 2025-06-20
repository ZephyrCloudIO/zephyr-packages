import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { ZephyrHostConfig, MCPServerEntry, LoadedMCPServer } from './types';
import { MCPRegistry } from './registry';
import { ModuleFederationLoader } from './module-federation-loader';

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
    console.log('Discovering MCP servers...');

    try {
      let servers: MCPServerEntry[] = [];
      
      // If direct MCP URLs are provided, create entries for them
      if (this.config.mcpUrls && this.config.mcpUrls.length > 0) {
        console.log(`Loading ${this.config.mcpUrls.length} MCP servers from provided URLs...`);
        
        for (const url of this.config.mcpUrls) {
          // Extract server name from URL
          // Example: https://nestor-lopez-1853-github-tools-mcp-example-zephyr-f1e0463b8-ze.zephyrcloud.app/remoteEntry.js
          const urlParts = new URL(url);
          const hostParts = urlParts.hostname.split('-');
          
          // Try to extract a meaningful name from the URL
          let serverName = 'mcp-server';
          if (hostParts.length > 4) {
            // Take parts that look like the actual name (github-tools-mcp)
            serverName = hostParts.slice(3, -3).join('-');
          }
          
          const entry: MCPServerEntry = {
            id: `${serverName}-${Date.now()}`,
            name: serverName,
            version: '1.0.0',
            description: `MCP server from ${urlParts.hostname}`,
            bundleUrl: url,
            metadata: {
              capabilities: {}
            },
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          servers.push(entry);
        }
      } else if (this.config.cloudUrl) {
        // Fetch from manifest URL
        console.log(`Fetching manifest from: ${this.config.cloudUrl}`);
        
        const response = await fetch(this.config.cloudUrl, {
          headers: this.config.apiKey ? {
            'Authorization': `Bearer ${this.config.apiKey}`,
          } : {},
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch manifest: ${response.statusText}`);
        }
        
        const manifest = await response.json();
        servers = manifest.servers || [];
      } else {
        console.log('No MCP URLs or manifest URL provided.');
        return;
      }

      for (const server of servers) {
        // Filter by allowed servers if specified
        if (
          this.config.allowedServers &&
          !this.config.allowedServers.includes(server.name)
        ) {
          continue;
        }

        const entry: MCPServerEntry = {
          id: server.id,
          name: server.name,
          version: server.version,
          description: server.description,
          bundleUrl: server.bundleUrl,
          metadata: server.metadata || {},
          status: server.status,
          createdAt: new Date(server.createdAt),
          updatedAt: new Date(server.updatedAt),
        };

        this.registry.register(entry);
      }

      console.log(`✓ Found ${this.registry.size()} MCP servers`);
    } catch (error) {
      console.error('Failed to discover servers:', error);
      throw error;
    }
  }

  private async loadServers(): Promise<void> {
    console.log('Loading MCP servers...');

    const entries = this.registry.getAll();

    for (const entry of entries) {
      try {
        console.log(`Loading ${entry.name} v${entry.version}...`);

        // Try Module Federation first
        let factory: () => Promise<any>;
        
        try {
          factory = await this.moduleLoader.loadMCPServer(entry);
          console.log(`✓ Loaded ${entry.name} via Module Federation`);
        } catch {
          console.log(`Module Federation failed for ${entry.name}, trying direct load...`);
          
          // Fallback to direct bundle loading
          const bundle = await this.downloadBundle(entry.bundleUrl);
          factory = await this.createServerFactory(bundle, entry);
          console.log(`✓ Loaded ${entry.name} via direct bundle`);
        }

        this.loadedServers.set(entry.name, {
          entry,
          factory,
        });
      } catch (error) {
        console.error(`Failed to load ${entry.name}:`, error);
      }
    }
  }

  private async downloadBundle(bundleUrl: string): Promise<Buffer> {
    // Use Zephyr Engine to download authenticated bundle
    // TODO: Implement actual API call
    // const response = await this.engine.api.get(bundleUrl, {
    //   responseType: 'arraybuffer',
    // });
    // return Buffer.from(response.data);
    
    // For now, use fetch
    const response = await fetch(bundleUrl);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private async createServerFactory(
    bundle: Buffer,
    entry: MCPServerEntry
  ): Promise<() => Promise<Server>> {
    // In production, this would use a proper sandbox (VM2, isolated-vm, etc.)
    // For now, we'll create a simple module loader

    const moduleCode = bundle.toString();

    // Create a module context
    const moduleExports: any = {};
    const moduleRequire = (id: string): any => {
      if (id === '@modelcontextprotocol/sdk/server/index.js') {
        return { Server };
      }
      throw new Error(`Module ${id} not allowed in sandbox`);
    };

    // Execute module (in production, use proper sandboxing)
    try {
      const moduleFunction = new Function(
        'exports',
        'require',
        'module',
        '__filename',
        '__dirname',
        moduleCode
      );

      moduleFunction(
        moduleExports,
        moduleRequire,
        { exports: moduleExports },
        `mcp://${entry.name}`,
        'mcp://'
      );

      // Find the default export or main server factory
      const factory =
        moduleExports.default ||
        moduleExports[entry.name] ||
        Object.values(moduleExports).find((v: any) => typeof v === 'function');

      if (typeof factory !== 'function') {
        throw new Error('No server factory function found in bundle');
      }

      return factory;
    } catch (error) {
      console.error(`Failed to create factory for ${entry.name}:`, error);
      throw error;
    }
  }

  private setupRequestHandlers(): void {
    // List all available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const allTools = [];

      for (const [serverName, loaded] of this.loadedServers) {
        try {
          // Get or create server instance
          if (!loaded.instance) {
            loaded.instance = await loaded.factory();
          }

          // Get tools from server
          const response = await (loaded.instance as any).request(
            { method: 'tools/list', params: {} },
            {}
          );

          if (response.tools) {
            // Namespace tools
            for (const tool of response.tools) {
              allTools.push({
                ...tool,
                name: `${serverName}.${tool.name}`,
                description: `[${serverName}] ${tool.description || ''}`,
                metadata: {
                  ...tool.metadata,
                  server: serverName,
                  version: loaded.entry.version,
                },
              });
            }
          }
        } catch (error) {
          console.error(`Failed to get tools from ${serverName}:`, error);
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
        // Get or create server instance
        if (!loaded.instance) {
          loaded.instance = await loaded.factory();
        }

        // Call the tool
        const response = await (loaded.instance as any).request(
          {
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: args,
            },
          },
          {}
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

    // Server info - TODO: Find proper schema
    // this.server.setRequestHandler('server/info', async () => {
    //   const servers = Array.from(this.loadedServers.values()).map((loaded) => ({
    //     name: loaded.entry.name,
    //     version: loaded.entry.version,
    //     description: loaded.entry.description,
    //     capabilities: loaded.entry.metadata.capabilities,
    //   }));
    //
    //   return {
    //     content: [
    //       {
    //         type: 'text',
    //         text: JSON.stringify(
    //           {
    //             name: 'zephyr-mcp-host',
    //             version: '1.0.0',
    //             type: 'host',
    //             environment: this.config.environment,
    //             servers,
    //           },
    //           null,
    //           2
    //         ),
    //       },
    //     ],
    //   };
    // });

    // Also handle resources and prompts
    this.setupResourceHandlers();
    this.setupPromptHandlers();
  }

  private setupResourceHandlers(): void {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const allResources = [];

      for (const [serverName, loaded] of this.loadedServers) {
        try {
          if (!loaded.instance) {
            loaded.instance = await loaded.factory();
          }

          const response = await (loaded.instance as any).request(
            { method: 'resources/list', params: {} },
            {}
          );

          if (response.resources) {
            for (const resource of response.resources) {
              allResources.push({
                ...resource,
                uri: `${serverName}:${resource.uri}`,
                metadata: {
                  ...resource.metadata,
                  server: serverName,
                },
              });
            }
          }
        } catch {
          // Server might not support resources
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

      if (!loaded.instance) {
        loaded.instance = await loaded.factory();
      }

      return (loaded.instance as any).request(
        {
          method: 'resources/read',
          params: { uri: resourceUri },
        },
        {}
      );
    });
  }

  private setupPromptHandlers(): void {
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const allPrompts = [];

      for (const [serverName, loaded] of this.loadedServers) {
        try {
          if (!loaded.instance) {
            loaded.instance = await loaded.factory();
          }

          const response = await (loaded.instance as any).request(
            { method: 'prompts/list', params: {} },
            {}
          );

          if (response.prompts) {
            for (const prompt of response.prompts) {
              allPrompts.push({
                ...prompt,
                name: `${serverName}.${prompt.name}`,
                metadata: {
                  ...prompt.metadata,
                  server: serverName,
                },
              });
            }
          }
        } catch {
          // Server might not support prompts
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

      if (!loaded.instance) {
        loaded.instance = await loaded.factory();
      }

      return (loaded.instance as any).request(
        {
          method: 'prompts/get',
          params: {
            name: promptName,
            arguments: args,
          },
        },
        {}
      );
    });
  }

  getServer(): Server {
    return this.server;
  }

  async connect(stdin: NodeJS.ReadStream, stdout: NodeJS.WriteStream): Promise<void> {
    // Connect using stdio transport
    const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

export async function createZephyrHostServer(
  config?: ZephyrHostConfig
): Promise<ZephyrHostMCPServer> {
  const host = new ZephyrHostMCPServer(config);
  await host.initialize();
  return host;
}
