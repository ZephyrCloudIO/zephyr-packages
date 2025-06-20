// Module Federation runtime will be dynamically imported
// to avoid bundling issues
import type { MCPServerEntry } from './types';

export class ModuleFederationLoader {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import to avoid build issues
      const { init } = await import('@module-federation/runtime');
      
      init({
        name: 'zephyr-mcp-host',
        remotes: [],
      });

      this.initialized = true;
    } catch {
      console.warn('Module Federation runtime not available, using fallback loader');
      this.initialized = true;
    }
  }

  async loadMCPServer(entry: MCPServerEntry): Promise<() => Promise<any>> {
    await this.initialize();

    try {
      // Extract remote name from URL
      // Example: https://nestor-lopez-1853-github-tools-mcp-example-zephyr-f1e0463b8-ze.zephyrcloud.app/remoteEntry.js
      const url = new URL(entry.bundleUrl);
      // const remoteName = entry.name.replace(/[^a-zA-Z0-9_]/g, '_');

      console.log(`Loading MCP server ${entry.name} from ${url.origin}`);

      // For now, we'll use a simpler approach
      // In production, this would use Module Federation's loadRemote
      const module = await this.loadModuleDirectly(entry.bundleUrl);

      // Return the module which should be a factory function
      return module;

      throw new Error(`No server factory function found in module from ${entry.name}`);
    } catch (error) {
      console.error(`Failed to load MCP server ${entry.name} via Module Federation:`, error);
      throw error;
    }
  }

  /**
   * Direct module loading as a fallback
   */
  private async loadModuleDirectly(_url: string): Promise<() => Promise<any>> {
    // This is a placeholder - in a real implementation,
    // this would handle loading the module from the URL
    // The _url parameter is prefixed with _ to indicate it's intentionally unused
    throw new Error(`Direct module loading not implemented. Use Module Federation or bundle loading.`);
  }
}