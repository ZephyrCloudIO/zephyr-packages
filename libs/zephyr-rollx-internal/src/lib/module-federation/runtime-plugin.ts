import type { ZeDependencyPair } from 'zephyr-agent';

export interface FederationRuntimePlugin {
  name: string;
  beforeInit?: (args: any) => any;
  init?: (args: any) => any;
  beforeRequest?: (args: any) => any;
  afterResolve?: (args: any) => any;
}

/**
 * Generates a runtime plugin for Module Federation remote resolution
 * This plugin integrates with Zephyr's dependency resolution system
 */
export function generateRuntimePlugin(
  resolvedRemotes: ZeDependencyPair[],
  edgeUrl?: string
): string {
  const plugin: FederationRuntimePlugin = {
    name: 'zephyr-runtime-remote-resolver',
    beforeInit(args: any) {
      const { options } = args;
      
      // Check session storage for edge URLs if available
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          const edgeUrlFromStorage = window.sessionStorage.getItem('edgeUrl');
          if (edgeUrlFromStorage) {
            // Use edge URL from session storage
            console.log('Using edge URL from session storage:', edgeUrlFromStorage);
          }
        } catch (error) {
          console.warn('Failed to read from session storage:', error);
        }
      }

      // Overwrite remote entry URLs with resolved URLs
      if (options.remotes) {
        resolvedRemotes.forEach(({ name, version }) => {
          if (options.remotes[name]) {
            const resolvedUrl = edgeUrl 
              ? `${edgeUrl}/${name}/${version}/remoteEntry.js`
              : options.remotes[name];
            
            console.log(`Resolving remote ${name} to:`, resolvedUrl);
            options.remotes[name] = {
              entry: resolvedUrl,
              ...options.remotes[name]
            };
          }
        });
      }

      return args;
    }
  };

  // Convert plugin object to template string for injection
  return `{
    name: '${plugin.name}',
    beforeInit(args) {
      const { options } = args;
      
      // Check session storage for edge URLs
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          const edgeUrlFromStorage = window.sessionStorage.getItem('edgeUrl');
          if (edgeUrlFromStorage) {
            console.log('Using edge URL from session storage:', edgeUrlFromStorage);
          }
        } catch (error) {
          console.warn('Failed to read from session storage:', error);
        }
      }

      // Overwrite remote entry URLs with resolved URLs
      if (options.remotes) {
        const resolvedRemotes = ${JSON.stringify(resolvedRemotes)};
        const edgeUrl = ${JSON.stringify(edgeUrl)};
        
        resolvedRemotes.forEach(({ name, version }) => {
          if (options.remotes[name]) {
            const resolvedUrl = edgeUrl 
              ? \`\${edgeUrl}/\${name}/\${version}/remoteEntry.js\`
              : options.remotes[name];
            
            console.log(\`Resolving remote \${name} to:\`, resolvedUrl);
            options.remotes[name] = {
              entry: resolvedUrl,
              ...options.remotes[name]
            };
          }
        });
      }

      return args;
    }
  }`;
}