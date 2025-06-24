import type { Configuration } from 'webpack';
import { ZephyrEngine, ZephyrError, logFn, ze_log } from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import type { ZephyrNextJSPluginOptions } from '../types';
import { ZeNextJSPlugin } from './ze-nextjs-plugin';

export function withZephyr(zephyrPluginOptions?: ZephyrNextJSPluginOptions) {
  return (config: Configuration, nextJSContext?: any) => {
    // Next.js expects synchronous webpack functions, so we can't use async/await here
    // Instead, we'll initialize Zephyr synchronously in the webpack plugin itself
    return _zephyr_configuration_sync(config, nextJSContext, zephyrPluginOptions);
  };
}

function _zephyr_configuration_sync(
  config: Configuration,
  nextJSContext: any,
  _zephyrOptions?: ZephyrNextJSPluginOptions
): Configuration {
  try {
    // Extract NextJS context safely
    const isServer = nextJSContext?.isServer ?? false;
    const nextRuntime = nextJSContext?.nextRuntime;
    const buildId = nextJSContext?.buildId ?? 'unknown';
    
    console.log('🔍 NextJS Build context:', { isServer, nextRuntime, buildId });
    
    // Skip deployment for server builds if deployOnClientOnly is enabled
    if (_zephyrOptions?.deployOnClientOnly && isServer) {
      console.log(`⏭️  Skipping Zephyr for ${nextRuntime || 'server'} build (deployOnClientOnly: true)`);
      return config;
    }
    
    // For Next.js, we need to handle async operations inside the webpack plugin
    // instead of here, since Next.js expects synchronous webpack functions
    // 
    // Add our NextJS-aware plugin that will handle async initialization
    config.plugins?.push(
      new ZeNextJSPlugin({
        // We'll pass null for now and initialize inside the plugin
        zephyr_engine: null as any,
        mfConfig: undefined,
        buildContext: {
          isServer,
          nextRuntime,
          buildId
        },
        wait_for_index_html: _zephyrOptions?.wait_for_index_html,
        deployOnClientOnly: _zephyrOptions?.deployOnClientOnly,
        preserveServerAssets: _zephyrOptions?.preserveServerAssets,
        // Server function support (Phase 1)
        enableServerFunctions: _zephyrOptions?.enableServerFunctions,
        serverRuntime: _zephyrOptions?.serverRuntime,
        enableMiddleware: _zephyrOptions?.enableMiddleware,
        enableISR: _zephyrOptions?.enableISR,
        cacheStrategy: _zephyrOptions?.cacheStrategy,
        // Add webpack config and context for async initialization
        webpackConfig: config,
        webpackContext: config.context,
      })
    );
  } catch (error) {
    logFn('error', ZephyrError.format(error));
  }

  // Return the config with minimal modifications
  // The plugin will handle async initialization and deployment through webpack hooks
  return config;
}