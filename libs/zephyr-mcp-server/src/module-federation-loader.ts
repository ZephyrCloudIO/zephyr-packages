// Module Federation runtime will be dynamically imported
// to avoid bundling issues
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  init,
  loadRemote,
  registerPlugins,
  registerRemotes,
} from '@module-federation/enhanced/runtime';
import runtimePlugin from '@module-federation/node/runtimePlugin';
import { logger } from './logger';
import type { MCPServerEntry } from './types';

export class ModuleFederationLoader {
  private initialized = false;

  private initializeRuntime(): void {
    if (!this.initialized) {
      // Initialize runtime once with empty remotes
      init({
        name: 'zephyr-mcp',
        remotes: [],
      });

      registerPlugins([runtimePlugin()]);
      this.initialized = true;
    }
  }

  async loadMCPServer(entry: MCPServerEntry): Promise<() => Promise<Server>> {
    try {
      // Check if we have manifest metadata
      if (entry.metadata?.['mfManifest']) {
        const manifest = entry.metadata['mfManifest'];

        // Find the exposed module
        if ((manifest as any).exposes && (manifest as any).exposes.length > 0) {
          const expose = (manifest as any).exposes[0];
          const exposePath = expose.path || './server';

          logger.log(`Loading ${entry.name} via Module Federation`);
          logger.log(`Container URL: ${entry.bundleUrl}`);
          logger.log(`Module path: ${exposePath}`);

          // Initialize runtime if not already done
          this.initializeRuntime();

          // Extract base URL from the bundle URL to use for chunk loading
          const baseUrl = entry.bundleUrl.substring(
            0,
            entry.bundleUrl.lastIndexOf('/') + 1
          );
          logger.log(`Base URL for chunks: ${baseUrl}`);

          // Set the webpack public path before loading the remote
          // This ensures chunks are loaded from the correct URL
          if (typeof global !== 'undefined') {
            (global as Record<string, unknown>)['__webpack_public_path__'] = baseUrl;
            (global as Record<string, unknown>)['__remoteModuleBaseUrl__'] = baseUrl;
          }

          // Register the remote based on mf-manifest
          registerRemotes([
            {
              name: (manifest as any).name,
              entry: entry.bundleUrl,
            },
          ]);

          // Load the remote module using loadRemote with format: "remoteName/expose"
          const moduleId = `${(manifest as any).name}${exposePath.startsWith('./') ? exposePath.substring(1) : '/' + exposePath}`;
          logger.log(`Loading module: ${moduleId}`);

          // Use loadRemote which should handle chunk loading properly
          const remoteModule = (await loadRemote(moduleId)) as unknown;

          // Handle different export patterns dynamically
          return async () => {
            // If it's already a function, call it to get the server instance
            if (typeof remoteModule === 'function') {
              const result = remoteModule();
              // If the result has a 'server' property, return that
              if (result && typeof result === 'object' && 'server' in result) {
                return result.server;
              }
              return result;
            }

            // If it has a default export
            if (
              remoteModule &&
              typeof remoteModule === 'object' &&
              'default' in remoteModule
            ) {
              const defaultExport = remoteModule.default;
              if (typeof defaultExport === 'function') {
                const result = defaultExport();
                return result && typeof result === 'object' && 'server' in result
                  ? result.server
                  : result;
              }
              return defaultExport;
            }

            // If it directly exports a server instance
            if (
              remoteModule &&
              typeof remoteModule === 'object' &&
              'server' in remoteModule
            ) {
              return remoteModule.server;
            }

            // Look for any factory function in the exports
            if (remoteModule && typeof remoteModule === 'object') {
              const exportKeys = Object.keys(remoteModule);
              for (const key of exportKeys) {
                const exportValue = (remoteModule as any)[key];
                if (
                  typeof exportValue === 'function' &&
                  (key.toLowerCase().includes('create') ||
                    key.toLowerCase().includes('factory') ||
                    key.toLowerCase().includes('server'))
                ) {
                  const result = exportValue();
                  return result && typeof result === 'object' && 'server' in result
                    ? result.server
                    : result;
                }
              }
            }

            // Return the module itself as last resort
            return remoteModule;
          };
        }
      }

      throw new Error('No Module Federation manifest found');
    } catch (error) {
      logger.error(
        `Failed to load MCP server ${entry.name} via Module Federation:`,
        error
      );
      throw error;
    }
  }
}
