import type { RsbuildPlugin } from '@rsbuild/core';
import { withZephyr as rspackWithZephyr } from 'zephyr-rspack-plugin';

export interface ModuleFederationConfig {
  name?: string;
  filename?: string;
  exposes?: Record<string, string>;
  remotes?: Record<string, string> | string[];
  shared?: string[] | Record<string, any>;
  library?: { type?: string; name?: string };
}

export interface ZephyrRsbuildPluginOptions {
  wait_for_index_html?: boolean;
  moduleFederationConfig?: ModuleFederationConfig;
}

/**
 * Extracts Module Federation config from Rspack plugins
 * This handles the @module-federation/rsbuild-plugin which adds MF plugins to Rspack config
 */
function extractModuleFederationFromRspack(config: any): ModuleFederationConfig | undefined {
  if (!config.plugins || !Array.isArray(config.plugins)) {
    console.log('[Zephyr Rsbuild] No plugins found in config');
    return undefined;
  }

  console.log('[Zephyr Rsbuild] Scanning', config.plugins.length, 'plugins for ModuleFederation');

  for (const plugin of config.plugins) {
    if (!plugin) continue;

    // Check for ModuleFederationPlugin by name
    const pluginName = plugin.constructor?.name || plugin.name || '';
    console.log('[Zephyr Rsbuild] Found plugin:', pluginName);

    if (pluginName.includes('ModuleFederationPlugin')) {
      console.log('[Zephyr Rsbuild] Found ModuleFederationPlugin! Extracting config...');
      // Try different property locations where MF config might be stored
      const mfConfig = plugin._options || plugin.options || plugin.config;
      if (mfConfig) {
        console.log('[Zephyr Rsbuild] MF Config extracted:', JSON.stringify(mfConfig, null, 2));
        // Handle nested config structure (e.g., NxModuleFederationPlugin)
        if ('config' in mfConfig) {
          return mfConfig.config;
        }
        return mfConfig;
      }
    }
  }

  console.log('[Zephyr Rsbuild] No ModuleFederationPlugin found in plugins');
  return undefined;
}

/**
 * Injects Module Federation config into Rspack config for Zephyr to process
 */
function injectModuleFederationIntoRspack(
  rspackConfig: any,
  mfConfig: ModuleFederationConfig
): void {
  if (!rspackConfig.plugins) {
    rspackConfig.plugins = [];
  }

  // Create a synthetic plugin object that looks like ModuleFederationPlugin
  // This allows the existing zephyr-xpack-internal extraction logic to work
  const syntheticPlugin = {
    constructor: { name: 'ModuleFederationPlugin' },
    name: 'ModuleFederationPlugin',
    _options: mfConfig,
  };

  // Add it to the beginning so it's found first
  rspackConfig.plugins.unshift(syntheticPlugin);
}

export function withZephyr(options?: ZephyrRsbuildPluginOptions): RsbuildPlugin {
  let capturedMfConfig: ModuleFederationConfig | undefined;

  return {
    name: 'zephyr-rsbuild-plugin',
    setup(api) {
      // Hook before modifyRspackConfig to capture MF config from Rsbuild plugins
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        console.log('[Zephyr Rsbuild] modifyRsbuildConfig called');
        console.log('[Zephyr Rsbuild] Rsbuild plugins:', config.plugins?.length || 0);

        // Try to find module federation plugin in Rsbuild plugins
        if (config.plugins) {
          for (const plugin of config.plugins) {
            if (!plugin) continue;
            const pluginDef: any = typeof plugin === 'function' ? null : plugin;
            const pluginName = pluginDef?.name || 'anonymous';
            console.log('[Zephyr Rsbuild] Rsbuild plugin:', pluginName);

            // Check if this is the module federation rsbuild plugin
            if (pluginName.includes('module-federation') || pluginName.includes('modulefederation')) {
              console.log('[Zephyr Rsbuild] Found Module Federation plugin!', pluginName);
              console.log('[Zephyr Rsbuild] Plugin structure keys:', Object.keys(pluginDef || {}));
              console.log('[Zephyr Rsbuild] Plugin own property names:', Object.getOwnPropertyNames(pluginDef));

              // Try to access all enumerable and non-enumerable properties
              const allKeys = [...Object.keys(pluginDef || {}), ...Object.getOwnPropertySymbols(pluginDef || {})];
              console.log('[Zephyr Rsbuild] All keys including symbols:', allKeys.map(k => String(k)));

              // The plugin should have options we can access - try multiple locations
              const mfOptions = pluginDef?.options || pluginDef?._options || pluginDef?.config || pluginDef?._config;
              if (mfOptions && typeof mfOptions !== 'function') {
                console.log('[Zephyr Rsbuild] Found MF options (not a function)');
                console.log('[Zephyr Rsbuild] MF options:', JSON.stringify(mfOptions, null, 2));
                capturedMfConfig = mfOptions;
              } else {
                console.log('[Zephyr Rsbuild] MF options is a function or not found, cannot extract config from plugin object');
                // As fallback, we need to get the config from the rsbuild.config.ts directly
                // This is a limitation - the plugin doesn't expose its config in an accessible way
              }
            }
          }
        }

        return config;
      });

      api.modifyRspackConfig(async (config, { mergeConfig }) => {
        // Try to extract or use provided Module Federation config
        let mfConfig = options?.moduleFederationConfig || capturedMfConfig;

        if (!mfConfig) {
          // Try to extract from Rspack plugins as fallback
          mfConfig = extractModuleFederationFromRspack(config);
        }

        // If we found MF config, inject it in a format Zephyr can recognize
        if (mfConfig) {
          console.log('[Zephyr Rsbuild] Injecting MF config into Rspack');
          injectModuleFederationIntoRspack(config, mfConfig);
        } else {
          console.log('[Zephyr Rsbuild] No MF config found to inject');
        }

        return await rspackWithZephyr(options)(config);
      });
    },
  };
}
