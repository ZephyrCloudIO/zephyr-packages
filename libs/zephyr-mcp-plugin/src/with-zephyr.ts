import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import type { Configuration as RspackConfiguration } from '@rspack/core';
import type { ZephyrMCPPluginOptions } from './types';

/**
 * Integrates Zephyr with Rspack for MCP servers Automatically deploys MCP servers to
 * Zephyr Cloud during build
 */
export function withZephyr(options: ZephyrMCPPluginOptions = {}) {
  return async (config: RspackConfiguration): Promise<RspackConfiguration> => {
    // Ensure we're building for Node.js
    if (!config.target) {
      config.target = 'async-node';
    }

    // Ensure plugins array exists
    if (!config.plugins) {
      config.plugins = [];
    }

    // Add Module Federation plugin if mfConfig is provided
    if (options.mfConfig) {
      config.plugins.push(
        new ModuleFederationPlugin({
          ...options.mfConfig,
          // Ensure shared dependencies include MCP SDK
          dts: false,
          shared: {
            '@modelcontextprotocol/sdk': {
              singleton: true,
              requiredVersion: '^1.0.0',
            },
            ...options.mfConfig.shared,
          },
          // Runtime plugins would go here for full Module Federation support
          // For now, the host uses direct bundle loading which works well
          library: {
            type: 'commonjs-module',
            name: options.mfConfig.name,
          },
          runtimePlugins: [
            require.resolve('@module-federation/node/runtimePlugin'),
          ]
        })
      );
    }

    // Apply Zephyr Rspack plugin for automatic deployment
    const { withZephyr: withZephyrRspack } = await import('zephyr-rspack-plugin');

    // Pass MCP-specific metadata through to Zephyr
    const enhancedConfig = await withZephyrRspack()(config);

    return enhancedConfig;
  };
}
