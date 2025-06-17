import type { ZeDependencyPair } from 'zephyr-agent';

export interface RemoteObjectConfig {
  external: string | string[];
  shareScope?: string;
}

export interface PartialMFConfig {
  remotes?:
    | Record<string, string | RemoteObjectConfig>
    | (string | RemoteObjectConfig)[]
    | any;
}

/**
 * Extracts remote dependencies from Module Federation configuration Falls back to
 * zephyrDependencies from package.json if no remotes found
 */
export function extract_remotes_dependencies(
  mfConfig: PartialMFConfig | undefined,
  packageJsonDependencies?: Record<string, string>
): ZeDependencyPair[] {
  // First check for zephyrDependencies in package.json
  if (packageJsonDependencies) {
    const zephyrDeps = Object.entries(packageJsonDependencies)
      .filter(([key]) => key.startsWith('zephyr-'))
      .map(([name, version]) => ({ name, version }));

    if (zephyrDeps.length > 0) {
      return zephyrDeps;
    }
  }

  // Fall back to extracting from Module Federation config
  if (!mfConfig?.remotes) {
    return [];
  }

  const remotes = mfConfig.remotes;
  const remoteDependencies: ZeDependencyPair[] = [];

  if (Array.isArray(remotes)) {
    // Handle array format: ['remote1@http://...', { name: 'remote2', url: '...' }]
    remotes.forEach((remote) => {
      if (typeof remote === 'string') {
        // Format: 'remoteName@url'
        const [name] = remote.split('@');
        if (name) {
          remoteDependencies.push({ name, version: 'latest' });
        }
      } else if (typeof remote === 'object' && remote !== null) {
        // Object format with external property
        const remoteObj = remote as RemoteObjectConfig;
        if (remoteObj.external) {
          // Extract name from external URL or use a default
          const name = Array.isArray(remoteObj.external)
            ? 'remote'
            : remoteObj.external.split('/').pop()?.split('@')[0] || 'remote';
          remoteDependencies.push({ name, version: 'latest' });
        }
      }
    });
  } else if (typeof remotes === 'object' && remotes !== null) {
    // Handle object format: { remote1: 'http://...', remote2: { external: '...' } }
    Object.entries(remotes).forEach(([name, config]) => {
      if (typeof config === 'string') {
        remoteDependencies.push({ name, version: 'latest' });
      } else if (typeof config === 'object' && config !== null) {
        remoteDependencies.push({ name, version: 'latest' });
      }
    });
  }

  return remoteDependencies;
}
