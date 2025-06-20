// Module Federation runtime will be dynamically imported
// to avoid bundling issues
import type { MCPServerEntry } from './types';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export class ModuleFederationLoader {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import to avoid build issues
      const runtime = await import('@module-federation/runtime');
      
      runtime.init({
        name: 'zephyr-mcp-host',
        remotes: [],
      });

      // Store runtime functions for later use
      (this as any).runtime = runtime;

      this.initialized = true;
    } catch (error) {
      console.warn('Module Federation runtime not available, using fallback loader:', error);
      this.initialized = true;
    }
  }

  async loadMCPServer(entry: MCPServerEntry): Promise<() => Promise<any>> {
    try {
      // Check if we have manifest metadata
      if (entry.metadata?.['mfManifest']) {
        const manifest = entry.metadata['mfManifest'];
        
        // Find the exposed module
        if (manifest.exposes && manifest.exposes.length > 0) {
          const expose = manifest.exposes[0];
          const exposePath = expose.path || './server';
          
          console.log(`Loading ${entry.name} via Module Federation`);
          console.log(`Container URL: ${entry.bundleUrl}`);
          console.log(`Module path: ${exposePath}`);
          
          // Load and initialize the container
          const container = await this.loadContainer(entry.bundleUrl, manifest.name);
          
          // Get the module from the container
          const factory = await container.get(exposePath);
          const remoteModule = factory();
          
          // Return a factory function
          return async () => {
            // Handle different export types
            if (typeof remoteModule === 'function') {
              return remoteModule();
            }
            if (remoteModule.default && typeof remoteModule.default === 'function') {
              return remoteModule.default();
            }
            if (remoteModule.createServer) {
              return remoteModule.createServer();
            }
            // Look for any exported function
            for (const key in remoteModule) {
              if (typeof remoteModule[key] === 'function' && 
                  (key.includes('create') || key.includes('Server'))) {
                return remoteModule[key]();
              }
            }
            throw new Error('No server factory found in remote module');
          };
        }
      }
      
      throw new Error('No Module Federation manifest found');
    } catch (error) {
      console.error(`Failed to load MCP server ${entry.name} via Module Federation:`, error);
      throw error;
    }
  }

  /**
   * Load a Module Federation container
   */
  private async loadContainer(url: string, scope: string): Promise<any> {
    // Download the container script
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch container from ${url}: ${response.statusText}`);
    }
    
    const scriptContent = await response.text();
    
    // Create a sandbox for the container
    const sandbox: any = {
      // Provide globals that the container might expect
      window: {},
      self: {},
      global: global,
      __webpack_require__: () => {},
      __webpack_exports__: {},
    };
    
    // Execute the container script
    // Module Federation containers are self-executing and assign to a global variable
    const func = new Function(scriptContent);
    func();
    
    // The container should now be available on the global scope
    const container = (global as any)[scope];
    
    if (!container) {
      console.error(`Container ${scope} not found. Available globals:`, Object.keys(global));
      throw new Error(`Container ${scope} not found after loading script`);
    }
    
    // Initialize the container with shared scope
    const shareScope = {
      // Add any shared dependencies here
      '@modelcontextprotocol/sdk/server/index.js': {
        get: () => Promise.resolve(() => require('@modelcontextprotocol/sdk/server/index.js')),
        loaded: true,
        from: 'host',
        eager: false,
      },
      '@modelcontextprotocol/sdk/types.js': {
        get: () => Promise.resolve(() => require('@modelcontextprotocol/sdk/types.js')),
        loaded: true,
        from: 'host',
        eager: false,
      },
    };
    
    // Initialize the container
    await container.init(shareScope);
    
    return container;
  }

  /**
   * Direct module loading as a fallback
   */
  private async loadModuleDirectly(entry: MCPServerEntry): Promise<() => Promise<any>> {
    // Check if this has MF manifest metadata
    if (entry.metadata?.['mfManifest']) {
      const manifest = entry.metadata['mfManifest'];
      const baseUrl = entry.bundleUrl.replace('/remoteEntry.js', '');
      
      // Look for exposes in the manifest
      if (manifest.exposes && manifest.exposes.length > 0) {
        // Use the first exposed module
        const expose = manifest.exposes[0];
        const modulePath = expose.assets?.js?.sync?.[1] || expose.assets?.js?.sync?.[0];
        
        if (modulePath) {
          console.log(`Loading exposed module: ${modulePath} from ${baseUrl}`);
          const moduleUrl = `${baseUrl}/${modulePath}`;
          
          // For now, throw to fall back to bundle loading
          // In production, this would properly load the module
          throw new Error(`Direct module loading not implemented. Use Module Federation or bundle loading.`);
        }
      }
    }
    
    throw new Error(`Direct module loading not implemented. Use Module Federation or bundle loading.`);
  }
}