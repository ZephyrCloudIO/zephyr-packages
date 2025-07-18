import { ModuleFederationPlugin } from '@module-federation/enhanced/rspack';
import type { Configuration as RspackConfiguration } from '@rspack/core';
import type { ZephyrMCPPluginOptions } from './types';
import { ZeMCPPlugin } from './ze-mcp-plugin';

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
          library: {
            type: 'commonjs-module',
            name: options.mfConfig.name,
          },
          runtimePlugins: [require.resolve('@module-federation/node/runtimePlugin')],
        })
      );
    }

    // Add our custom MCP plugin
    config.plugins.push(new ZeMCPPlugin(options));

    return config;
  };
}
