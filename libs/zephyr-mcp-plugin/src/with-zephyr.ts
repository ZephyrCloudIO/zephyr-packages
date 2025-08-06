import type { Compiler as RspackCompiler } from '@rspack/core';
import type { Compiler as WebpackCompiler } from 'webpack';
import type { XPackConfiguration } from 'zephyr-xpack-internal';
import type { ZephyrMCPPluginOptions } from './types';
import { ZeMCPPlugin } from './ze-mcp-plugin';

// Union type for supported compilers
type SupportedCompiler = WebpackCompiler | RspackCompiler;

export function withZephyr(
  options: ZephyrMCPPluginOptions
): (config: XPackConfiguration<WebpackCompiler>) => XPackConfiguration<WebpackCompiler>;
export function withZephyr(
  options: ZephyrMCPPluginOptions
): (config: XPackConfiguration<RspackCompiler>) => XPackConfiguration<RspackCompiler>;

/**
 * Integrates Zephyr with webpack/rspack for MCP servers. Automatically deploys MCP
 * servers to Zephyr Cloud during build
 *
 * @template T - The compiler type (webpack.Compiler or @rspack/core.Compiler)
 * @param options - Configuration options for the Zephyr MCP plugin (REQUIRED)
 * @returns A function that takes a webpack/rspack configuration and returns the modified
 *   configuration
 */
export function withZephyr<T extends SupportedCompiler = SupportedCompiler>(
  options: ZephyrMCPPluginOptions
) {
  return (config: XPackConfiguration<T>): XPackConfiguration<T> => {
    // Ensure we're building for Node.js
    if (!options.mfConfig?.target || options.mfConfig.target !== 'async-node') {
      options.mfConfig = options.mfConfig || { name: '', filename: '' };
      options.mfConfig.target = 'async-node';
    }

    // Ensure plugins array exists
    if (!config.plugins) {
      config.plugins = [];
    }

    // Extract Module Federation config from existing plugins if available
    // const mfPlugin = config.plugins.find(
    //   (plugin: any) =>
    //     plugin &&
    //     plugin.constructor &&
    //     plugin.constructor.name === 'ModuleFederationPlugin'
    // ) as ModuleFederationPlugin;

    // if (mfPlugin && mfPlugin._options) {
    //   // Use the Module Federation config from the existing plugin
    //   options.mfConfig = {
    //     name: mfPlugin._options.name,
    //     filename: mfPlugin._options.filename,
    //     exposes: mfPlugin._options.exposes,
    //     remotes: mfPlugin._options.remotes,
    //     shared: mfPlugin._options.shared,
    //     runtimePlugins: mfPlugin._options.runtimePlugins,
    //   };
    // }

    // Add our custom MCP plugin
    config.plugins.push(new ZeMCPPlugin(options));

    return config;
  };
}
