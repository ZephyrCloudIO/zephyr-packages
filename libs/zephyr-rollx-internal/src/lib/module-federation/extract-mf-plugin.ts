import type { XFederatedConfig } from '../../types';

export interface ViteMFPlugin {
  name: string;
  _options?: XFederatedConfig;
  config?: XFederatedConfig;
}

export interface WebpackMFPlugin {
  apply: (compiler: unknown) => void;
}

export interface RolldownMFPlugin {
  name: string;
  config?: XFederatedConfig;
}

/**
 * Extracts Module Federation plugin from a plugin array Works with Vite, Webpack, and
 * Rolldown plugins
 */
export function extract_mf_plugin(plugins: any[]): XFederatedConfig | null {
  if (!Array.isArray(plugins)) {
    return null;
  }

  // Look for various Module Federation plugin signatures
  for (const plugin of plugins) {
    if (!plugin) continue;

    // Vite Module Federation plugin
    if (plugin.name === 'module-federation-vite' && plugin._options) {
      return {
        ...plugin._options,
      };
    }

    // Rolldown Module Federation plugin (future support)
    if (plugin.name.includes('module-federation/vite') && plugin.config) {
      return {
        ...plugin.config,
      };
    }

    // Generic check for Module Federation plugin interface
    if (plugin.apply && (plugin._options || plugin.config)) {
      return plugin;
    }
  }

  return null;
}

/** Extracts Module Federation configuration from a plugin */
export function extractMFConfig(
  plugin: ViteMFPlugin | null
): XFederatedConfig | undefined {
  if (!plugin) return undefined;

  // Try different configuration access patterns
  if (plugin._options) {
    // Handle nested config object (some plugins wrap config)
    if (typeof plugin._options === 'object' && 'config' in plugin._options) {
      return (plugin._options as { config: XFederatedConfig }).config;
    }
    return plugin._options;
  }

  if (plugin.config) {
    return plugin.config;
  }

  return undefined;
}
