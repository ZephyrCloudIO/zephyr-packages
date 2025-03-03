/**
 * Enhanced Configuration Extraction
 * 
 * This module implements an enhanced configuration extraction abstraction
 * that works with both Module Federation 1.0 and 2.0 plugins.
 */

import {
  MFVersion,
  isModuleFederationPlugin,
  getMFVersionFromPlugin,
  createMFConfigExtractor
} from './enhanced-plugin-detection';

/**
 * Extended interfaces for federated configuration
 */

// Base interface for common fields
interface BaseFederatedConfig {
  name: string;
  filename?: string;
  library?: {
    type?: string;
  };
}

// MF 1.0 specific configuration
interface MF1FederatedConfig extends BaseFederatedConfig {
  remotes?: Record<string, string | RemotesConfig | string[]>;
  exposes?: Record<string, string | Record<string, string>>;
  shared?: Record<string, unknown>;
}

// MF 2.0 specific configuration
interface MF2FederatedConfig extends BaseFederatedConfig {
  remotes?: Array<{
    alias: string;
    entry: string;
    federationContainerName?: string;
    moduleName?: string;
  }> | Record<string, string | RemotesConfig | string[]>;
  exposes?: Array<{
    name: string;
    path: string;
    id?: string;
  }> | Record<string, string | Record<string, string>>;
  shared?: Array<{
    name: string;
    version?: string;
    singleton?: boolean;
    requiredVersion?: string;
    eager?: boolean;
  }> | Record<string, unknown>;
  runtimePlugins?: Array<string | object>;
  manifestPlugin?: boolean | object;
}

// Combined interface for all possible configurations
interface XFederatedConfig extends BaseFederatedConfig {
  remotes?: Record<string, string | RemotesConfig | string[]> | Array<{
    alias: string;
    entry: string;
    federationContainerName?: string;
    moduleName?: string;
  }>;
  exposes?: Record<string, string | Record<string, string>> | Array<{
    name: string;
    path: string;
    id?: string;
  }>;
  shared?: Record<string, unknown> | Array<{
    name: string;
    version?: string;
    singleton?: boolean;
    requiredVersion?: string;
    eager?: boolean;
  }>;
  runtimePlugins?: Array<string | object>;
  manifestPlugin?: boolean | object;
  mfVersion?: MFVersion;
}

interface RemotesConfig {
  /** Container locations from which modules should be resolved and loaded at runtime. */
  external: string | string[];

  /** The name of the share scope shared with this remote. */
  shareScope?: string;
}

/**
 * Configuration for webpack/rspack
 */
interface XPackConfiguration<Compiler> {
  context?: string;
  plugins?: (
    | undefined
    | null
    | false
    | ''
    | 0
    | ((this: Compiler, compiler: Compiler) => void)
    | WebpackPluginInstance<Compiler>
  )[];
}

interface WebpackPluginInstance<Compiler> {
  [index: string]: any;
  apply: (compiler: Compiler) => void;
}

/**
 * Enhanced version of iterateFederationConfig that supports both MF 1.0 and 2.0
 */
function iterateFederationConfig<Compiler, K = XFederatedConfig>(
  config: XPackConfiguration<Compiler>,
  for_remote: (federatedConfig: XFederatedConfig) => K
): K[] {
  if (!config.plugins) {
    return [];
  }

  const results: K[] = [];
  for (const plugin of config.plugins) {
    if (!isModuleFederationPlugin(plugin)) {
      continue;
    }
    
    // Get the appropriate extractor for this plugin
    const extractor = createMFConfigExtractor(plugin);
    
    // Create a normalized configuration
    const federatedConfig: XFederatedConfig = {
      name: extractor.extractName(),
      filename: extractor.extractFilename(),
      library: {
        type: extractor.extractLibraryType()
      },
      remotes: normalizeRemotes(extractor.extractRemotes()),
      exposes: normalizeExposes(extractor.extractExposes()),
      shared: normalizeShared(extractor.extractShared()),
      mfVersion: extractor.getMFVersion()
    };
    
    // Add MF 2.0 specific properties if applicable
    if (extractor.getMFVersion() === MFVersion.MF2) {
      federatedConfig.runtimePlugins = extractor.extractRuntimePlugins();
    }
    
    results.push(for_remote(federatedConfig));
  }

  return results;
}

/**
 * Enhanced version of iterateFederatedRemoteConfig that supports both MF 1.0 and 2.0
 */
function iterateFederatedRemoteConfig<Compiler, K = XFederatedConfig>(
  config: XPackConfiguration<Compiler>,
  for_remote: (federatedRemoteConfig: XFederatedConfig) => K
): K[] {
  return iterateFederationConfig(config, for_remote);
}

/**
 * Helper to normalize remotes from different formats
 */
function normalizeRemotes(remotes: any): Record<string, string> {
  if (!remotes) {
    return {};
  }
  
  // Already in record format
  if (typeof remotes === 'object' && !Array.isArray(remotes)) {
    // Convert any complex values to strings
    return Object.entries(remotes).reduce((acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value;
      } else if (value && typeof value === 'object') {
        if ('external' in value) {
          // Handle RemotesConfig
          acc[key] = Array.isArray(value.external) 
            ? value.external[0] 
            : value.external;
        } else if ('entry' in value) {
          // Handle MF 2.0 style object
          acc[key] = value.entry;
        }
      }
      return acc;
    }, {} as Record<string, string>);
  }
  
  // Array format (common in MF 2.0)
  if (Array.isArray(remotes)) {
    return remotes.reduce((acc, remote) => {
      if (typeof remote === 'string') {
        const parts = remote.split('@');
        acc[parts[0]] = parts[1] || '';
      } else if (remote && typeof remote === 'object') {
        if ('alias' in remote && 'entry' in remote) {
          acc[remote.alias] = remote.entry;
        }
      }
      return acc;
    }, {} as Record<string, string>);
  }
  
  return {};
}

/**
 * Helper to normalize exposes from different formats
 */
function normalizeExposes(exposes: any): Record<string, string> {
  if (!exposes) {
    return {};
  }
  
  // Already in record format
  if (typeof exposes === 'object' && !Array.isArray(exposes)) {
    // Handle nested objects
    return Object.entries(exposes).reduce((acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = value;
      } else if (value && typeof value === 'object' && 'import' in value) {
        acc[key] = value.import;
      }
      return acc;
    }, {} as Record<string, string>);
  }
  
  // Array format (common in MF 2.0)
  if (Array.isArray(exposes)) {
    return exposes.reduce((acc, expose) => {
      if (typeof expose === 'string') {
        const parts = expose.split(':');
        acc[parts[0]] = parts[1] || parts[0];
      } else if (expose && typeof expose === 'object') {
        if ('name' in expose && 'path' in expose) {
          acc[expose.name] = expose.path;
        }
      }
      return acc;
    }, {} as Record<string, string>);
  }
  
  return {};
}

/**
 * Helper to normalize shared from different formats
 */
function normalizeShared(shared: any): Record<string, unknown> {
  if (!shared) {
    return {};
  }
  
  // Already in record format
  if (typeof shared === 'object' && !Array.isArray(shared)) {
    return shared;
  }
  
  // Array format (common in MF 2.0)
  if (Array.isArray(shared)) {
    return shared.reduce((acc, item) => {
      if (typeof item === 'string') {
        acc[item] = { singleton: true };
      } else if (item && typeof item === 'object' && 'name' in item) {
        acc[item.name] = {
          singleton: item.singleton,
          requiredVersion: item.requiredVersion,
          version: item.version,
          eager: item.eager
        };
      }
      return acc;
    }, {} as Record<string, unknown>);
  }
  
  return {};
}

/**
 * Extract federated dependency pairs with support for MF 1.0 and 2.0
 */
function extractFederatedDependencyPairs(
  config: XPackConfiguration<any>,
  readPackageJson: (context: string) => { zephyrDependencies?: Record<string, string> }
): Array<{ name: string; version: string }> {
  const depsPairs: Array<{ name: string; version: string }> = [];

  // Extract from package.json
  const { zephyrDependencies } = readPackageJson(config.context || process.cwd());
  if (zephyrDependencies) {
    Object.entries(zephyrDependencies).forEach(([name, version]) => {
      depsPairs.push({ name, version });
    });
  }

  // Extract from Module Federation config
  iterateFederatedRemoteConfig(config, (remoteConfig: XFederatedConfig) => {
    if (!remoteConfig.remotes) return;
    
    // Handle record format
    if (!Array.isArray(remoteConfig.remotes)) {
      Object.entries(remoteConfig.remotes).forEach(([name, version]) => {
        // Only add string versions
        if (typeof version === 'string') {
          depsPairs.push({ name, version });
        }
      });
    } 
    // Handle array format
    else {
      remoteConfig.remotes.forEach(remote => {
        if (typeof remote === 'object' && 'alias' in remote && 'entry' in remote) {
          depsPairs.push({
            name: remote.alias,
            version: remote.entry
          });
        }
      });
    }
  });

  return depsPairs;
}

/**
 * Exports
 */
export {
  XFederatedConfig,
  MF1FederatedConfig,
  MF2FederatedConfig,
  XPackConfiguration,
  iterateFederationConfig,
  iterateFederatedRemoteConfig,
  normalizeRemotes,
  normalizeExposes,
  normalizeShared,
  extractFederatedDependencyPairs
};