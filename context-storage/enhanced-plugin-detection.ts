/**
 * Enhanced Module Federation Plugin Detection
 * 
 * This module enhances the plugin detection capabilities to support both
 * Module Federation 1.0 and 2.0 plugins.
 */

/**
 * Types for webpack and module federation plugins
 */
interface WebpackPluginInstance {
  [index: string]: any;
  apply: (compiler: any) => void;
}

interface ModuleFederationPlugin extends WebpackPluginInstance {
  _options?: any;
  config?: any;
}

/**
 * MF Version enum
 */
enum MFVersion {
  MF1 = 'MF1',
  MF2 = 'MF2',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Enhanced function to detect if a plugin is a Module Federation plugin
 * (either MF 1.0 or MF 2.0)
 */
function isModuleFederationPlugin(plugin?: any): plugin is ModuleFederationPlugin {
  if (!plugin || typeof plugin !== 'object') return false;

  // Check for MF 1.0 pattern via constructor name
  if (
    typeof plugin.constructor?.name?.includes === 'function' &&
    plugin.constructor.name?.includes('ModuleFederationPlugin')
  ) {
    return true;
  }

  // Check for MF 2.0 pattern via constructor name
  if (
    typeof plugin.constructor?.name?.includes === 'function' &&
    (
      plugin.constructor.name?.includes('@module-federation/enhanced') ||
      plugin.constructor.name?.includes('NativeFederation')
    )
  ) {
    return true;
  }

  // Fallback: check by plugin name
  if (typeof plugin['name'] === 'string' && typeof plugin['name']?.includes === 'function') {
    if (
      plugin['name']?.includes('ModuleFederationPlugin') ||
      plugin['name']?.includes('@module-federation/enhanced') ||
      plugin['name']?.includes('NativeFederation')
    ) {
      return true;
    }
  }

  // Check for options pattern specific to MF plugins
  if (
    (plugin._options && (
      plugin._options.name && 
      (plugin._options.remotes || plugin._options.exposes || plugin._options.shared)
    )) ||
    (plugin.config && (
      plugin.config.name &&
      (plugin.config.remotes || plugin.config.exposes || plugin.config.shared)
    ))
  ) {
    return true;
  }

  return false;
}

/**
 * Determine the Module Federation version from a plugin
 */
function getMFVersionFromPlugin(plugin: any): MFVersion {
  if (!isModuleFederationPlugin(plugin)) {
    return MFVersion.UNKNOWN;
  }

  // Check for MF 2.0 patterns
  if (
    // Check constructor name
    (typeof plugin.constructor?.name?.includes === 'function' &&
    (
      plugin.constructor.name?.includes('@module-federation/enhanced') ||
      plugin.constructor.name?.includes('NativeFederation')
    )) ||
    // Check plugin name
    (typeof plugin['name'] === 'string' && 
     typeof plugin['name']?.includes === 'function' &&
     (
       plugin['name']?.includes('@module-federation/enhanced') ||
       plugin['name']?.includes('NativeFederation')
     ))
  ) {
    return MFVersion.MF2;
  }

  // Check for MF 2.0 specific options
  if (
    (plugin._options && (
      plugin._options.runtimePlugins ||
      plugin._options.manifestPlugin ||
      plugin._options.delegate
    )) ||
    (plugin.config && (
      plugin.config.runtimePlugins ||
      plugin.config.manifestPlugin ||
      plugin.config.delegate
    ))
  ) {
    return MFVersion.MF2;
  }

  // Default to MF 1.0 if it's a federation plugin but not MF 2.0
  return MFVersion.MF1;
}

/**
 * Extract the configuration from a Module Federation plugin
 * regardless of its version
 */
function extractModuleFederationConfig(plugin: ModuleFederationPlugin): any {
  if (!plugin) {
    return null;
  }

  // First try to get the options directly
  if (plugin._options) {
    return plugin._options;
  }

  // Then try to get from config (used by Repack)
  if (plugin.config) {
    return plugin.config;
  }

  // Last resort: try to find options in the plugin itself
  const possibleOptions = ['options', 'opts', 'settings', 'configuration'];
  for (const opt of possibleOptions) {
    if (plugin[opt] && typeof plugin[opt] === 'object') {
      return plugin[opt];
    }
  }

  return null;
}

/**
 * Config extractor interface for different MF versions
 */
interface MFConfigExtractor {
  extractName(): string;
  extractRemotes(): Record<string, string | any>;
  extractExposes(): Record<string, string | any>;
  extractShared(): Record<string, any>;
  extractRuntimePlugins(): any[];
  extractLibraryType(): string | undefined;
  extractFilename(): string;
  getMFVersion(): MFVersion;
}

/**
 * Base config extractor implementation
 */
abstract class BaseMFConfigExtractor implements MFConfigExtractor {
  constructor(protected plugin: ModuleFederationPlugin) {}
  
  abstract getMFVersion(): MFVersion;
  
  extractName(): string {
    const config = extractModuleFederationConfig(this.plugin);
    return config?.name || '';
  }
  
  extractLibraryType(): string | undefined {
    const config = extractModuleFederationConfig(this.plugin);
    return config?.library?.type;
  }
  
  extractFilename(): string {
    const config = extractModuleFederationConfig(this.plugin);
    return config?.filename || 'remoteEntry.js';
  }
  
  abstract extractRemotes(): Record<string, string | any>;
  abstract extractExposes(): Record<string, string | any>;
  abstract extractShared(): Record<string, any>;
  abstract extractRuntimePlugins(): any[];
}

/**
 * MF 1.0 config extractor
 */
class MF1ConfigExtractor extends BaseMFConfigExtractor {
  getMFVersion(): MFVersion {
    return MFVersion.MF1;
  }
  
  extractRemotes(): Record<string, string | any> {
    const config = extractModuleFederationConfig(this.plugin);
    if (!config?.remotes) {
      return {};
    }
    
    // Handle array format (not common in MF 1.0)
    if (Array.isArray(config.remotes)) {
      return config.remotes.reduce((acc, remote) => {
        if (typeof remote === 'string') {
          const parts = remote.split('@');
          acc[parts[0]] = parts[1] || '';
        } else if (typeof remote === 'object') {
          acc[remote.name || remote.alias || ''] = remote.entry || remote.url || '';
        }
        return acc;
      }, {});
    }
    
    // Handle object format (common in MF 1.0)
    return config.remotes;
  }
  
  extractExposes(): Record<string, string | any> {
    const config = extractModuleFederationConfig(this.plugin);
    if (!config?.exposes) {
      return {};
    }
    
    // Handle array format (not common in MF 1.0)
    if (Array.isArray(config.exposes)) {
      return config.exposes.reduce((acc, expose) => {
        if (typeof expose === 'string') {
          const parts = expose.split(':');
          acc[parts[0]] = parts[1] || parts[0];
        } else if (typeof expose === 'object') {
          acc[expose.name || ''] = expose.path || expose.import || '';
        }
        return acc;
      }, {});
    }
    
    // Handle object format (common in MF 1.0)
    return config.exposes;
  }
  
  extractShared(): Record<string, any> {
    const config = extractModuleFederationConfig(this.plugin);
    if (!config?.shared) {
      return {};
    }
    
    // Handle array format
    if (Array.isArray(config.shared)) {
      return config.shared.reduce((acc, shared) => {
        if (typeof shared === 'string') {
          acc[shared] = { singleton: true };
        } else if (typeof shared === 'object') {
          acc[shared.name || ''] = {
            singleton: shared.singleton,
            version: shared.version,
            requiredVersion: shared.requiredVersion
          };
        }
        return acc;
      }, {});
    }
    
    // Handle object format
    return config.shared;
  }
  
  extractRuntimePlugins(): any[] {
    // MF 1.0 doesn't support runtime plugins
    return [];
  }
}

/**
 * MF 2.0 config extractor
 */
class MF2ConfigExtractor extends BaseMFConfigExtractor {
  getMFVersion(): MFVersion {
    return MFVersion.MF2;
  }
  
  extractRemotes(): Record<string, string | any> {
    const config = extractModuleFederationConfig(this.plugin);
    if (!config?.remotes) {
      return {};
    }
    
    // Handle array format (common in MF 2.0)
    if (Array.isArray(config.remotes)) {
      return config.remotes.reduce((acc, remote) => {
        if (typeof remote === 'string') {
          const parts = remote.split('@');
          acc[parts[0]] = parts[1] || '';
        } else if (typeof remote === 'object') {
          acc[remote.alias || remote.name || ''] = remote.entry || remote.url || '';
        }
        return acc;
      }, {});
    }
    
    // Handle object format (for backward compatibility)
    return config.remotes;
  }
  
  extractExposes(): Record<string, string | any> {
    const config = extractModuleFederationConfig(this.plugin);
    if (!config?.exposes) {
      return {};
    }
    
    // Handle array format (common in MF 2.0)
    if (Array.isArray(config.exposes)) {
      return config.exposes.reduce((acc, expose) => {
        if (typeof expose === 'string') {
          const parts = expose.split(':');
          acc[parts[0]] = parts[1] || parts[0];
        } else if (typeof expose === 'object') {
          acc[expose.name || ''] = expose.path || expose.import || '';
        }
        return acc;
      }, {});
    }
    
    // Handle object format (for backward compatibility)
    return config.exposes;
  }
  
  extractShared(): Record<string, any> {
    const config = extractModuleFederationConfig(this.plugin);
    if (!config?.shared) {
      return {};
    }
    
    // Handle array format
    if (Array.isArray(config.shared)) {
      return config.shared.reduce((acc, shared) => {
        if (typeof shared === 'string') {
          acc[shared] = { singleton: true };
        } else if (typeof shared === 'object') {
          acc[shared.name || ''] = {
            singleton: shared.singleton,
            version: shared.version,
            requiredVersion: shared.requiredVersion,
            eager: shared.eager
          };
        }
        return acc;
      }, {});
    }
    
    // Handle object format
    return config.shared;
  }
  
  extractRuntimePlugins(): any[] {
    const config = extractModuleFederationConfig(this.plugin);
    return config?.runtimePlugins || [];
  }
}

/**
 * Factory function to create an appropriate config extractor based on the plugin version
 */
function createMFConfigExtractor(plugin: ModuleFederationPlugin): MFConfigExtractor {
  const version = getMFVersionFromPlugin(plugin);
  
  switch (version) {
    case MFVersion.MF2:
      return new MF2ConfigExtractor(plugin);
    case MFVersion.MF1:
    default:
      return new MF1ConfigExtractor(plugin);
  }
}

/**
 * Exports
 */
export {
  MFVersion,
  isModuleFederationPlugin,
  getMFVersionFromPlugin,
  extractModuleFederationConfig,
  MFConfigExtractor,
  BaseMFConfigExtractor,
  MF1ConfigExtractor,
  MF2ConfigExtractor,
  createMFConfigExtractor
};