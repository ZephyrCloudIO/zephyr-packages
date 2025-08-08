import type { Compiler as RspackCompiler } from '@rspack/core';
import type { Compiler as WebpackCompiler } from 'webpack';
import type { XPackConfiguration } from 'zephyr-xpack-internal';
import type { ZephyrMCPPluginOptions } from './types';
import { ZeMCPPlugin } from './ze-mcp-plugin';

type SupportedCompiler = WebpackCompiler | RspackCompiler;

// Function overloads for TypeScript type inference
export function withZephyr(
  options: ZephyrMCPPluginOptions
): (config: XPackConfiguration<WebpackCompiler>) => XPackConfiguration<WebpackCompiler>;

export function withZephyr(
  options: ZephyrMCPPluginOptions
): (config: XPackConfiguration<RspackCompiler>) => XPackConfiguration<RspackCompiler>;

/**
 * Integrates Zephyr with webpack/rspack for MCP servers Automatically deploys MCP servers
 * to Zephyr Cloud during build
 *
 * @example
 *   ```javascript
 *   const config = defineConfig({ ... });
 *   module.exports = withZephyr({
 *     mcpVersion: '1.0.0',
 *     mcpMetadata: {
 *       description: 'My MCP server',
 *       capabilities: { tools: ['my_tool'] }
 *     }
 *   })(config);
 *   ```;
 *
 * @param options - Configuration options for the Zephyr MCP plugin
 * @returns A function that takes a webpack/rspack configuration and returns the modified
 *   configuration
 */
export function withZephyr<T extends SupportedCompiler = SupportedCompiler>(
  options: ZephyrMCPPluginOptions
) {
  return (config: XPackConfiguration<T>): XPackConfiguration<T> => {
    // Ensure MCP servers are built for Node.js runtime
    if (
      options.mfConfig &&
      (!options.mfConfig.target || options.mfConfig.target !== 'async-node')
    ) {
      options.mfConfig.target = 'async-node';
    }

    // Initialize plugins array if not present
    config.plugins = config.plugins || [];

    // Add Zephyr MCP plugin
    config.plugins.push(new ZeMCPPlugin(options));

    return config;
  };
}
