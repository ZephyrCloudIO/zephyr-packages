import type { RsbuildPlugin } from '@rsbuild/core';
import type { Compiler, Configuration as RspackConfiguration } from '@rspack/core';
import { logFn, ZephyrEngine, ZephyrError } from 'zephyr-agent';
import type { XPackConfiguration } from 'zephyr-xpack-internal';
import {
  extractFederatedDependencyPairs,
  makeCopyOfModuleFederationOptions,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import type { ZephyrRspackPluginOptions } from '../types';
import { ZeRspackPlugin } from './ze-rspack-plugin';

export type Configuration = RspackConfiguration;

/**
 * Type that ensures all required properties are non-nullable, compatible with rsbuild's
 * NarrowedRspackConfig
 */
export type ZephyrRspackConfig = RspackConfiguration & {
  plugins: NonNullable<RspackConfiguration['plugins']>;
  module: NonNullable<RspackConfiguration['module']>;
  resolve: NonNullable<RspackConfiguration['resolve']>;
  output: NonNullable<RspackConfiguration['output']>;
};

/** Detects if we're being called from rsbuild context by checking the call stack */
function isCalledFromRsbuild(): boolean {
  const stack = new Error().stack;
  return stack
    ? stack.includes('@rsbuild') ||
        stack.includes('rsbuild') ||
        stack.includes('rspeedy') ||
        stack.includes('@lynx-js')
    : false;
}

/** Common configuration logic shared between rsbuild and rspack contexts */
async function applyZephyrConfiguration(
  config: XPackConfiguration<Compiler>,
  contextPath: string,
  options?: ZephyrRspackPluginOptions
): Promise<void> {
  const zephyr_engine = await ZephyrEngine.create({
    builder: 'rspack',
    context: contextPath,
  });

  // Resolve dependencies and update the config
  const dependencyPairs = extractFederatedDependencyPairs(config);
  const resolved_dependency_pairs =
    await zephyr_engine.resolve_remote_dependencies(dependencyPairs);

  mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);

  // Ensure plugins array exists
  if (!config.plugins) {
    config.plugins = [];
  }

  // Inject the ZephyrRspackPlugin
  config.plugins.push(
    new ZeRspackPlugin({
      zephyr_engine,
      mfConfig: makeCopyOfModuleFederationOptions(config),
      wait_for_index_html: options?.wait_for_index_html,
    })
  );
}

/** Creates a native rsbuild plugin */
function createRsbuildPlugin(options?: ZephyrRspackPluginOptions): RsbuildPlugin {
  return {
    name: 'zephyr',
    setup(api) {
      api.modifyRspackConfig(async (config) => {
        try {
          const context = api.context;
          await applyZephyrConfiguration(config, context.rootPath, options);
          return config;
        } catch (error) {
          logFn('error', ZephyrError.format(error));
          return config;
        }
      });
    },
  };
}

// Type that represents a callable transformer function
type ZephyrTransformer = {
  (): (config: Configuration) => Promise<ZephyrRspackConfig>;
  (config: Configuration): Promise<ZephyrRspackConfig>;
};

// Universal type that works in both contexts
type ZephyrUniversal = RsbuildPlugin & ZephyrTransformer;

// Function overloads that return the universal type
export function withZephyr(): ZephyrUniversal;
export function withZephyr(options: ZephyrRspackPluginOptions): ZephyrUniversal;
export function withZephyr(
  options: ZephyrRspackPluginOptions | undefined
): ZephyrUniversal;

/**
 * Universal withZephyr function that automatically adapts to context:
 *
 * @example
 *   // In rsbuild plugin array
 *   export default defineConfig({
 *     plugins: [withZephyr()],
 *   });
 *
 * @example
 *   // As rspack config transformer
 *   export default withZephyr()({
 *     // rspack config
 *   });
 */
export function withZephyr(options?: ZephyrRspackPluginOptions): ZephyrUniversal {
  // Check if this is being called in a more sophisticated context where we need to return a function
  const stack = new Error().stack;
  const isInFunctionCall = stack
    ? stack.includes('rspack(') || stack.includes('modifyRspackConfig')
    : false;

  // Return rspack config transformer - with proper typing
  const configTransformer = (config: Configuration): Promise<ZephyrRspackConfig> =>
    processRspackConfiguration(config, options);

  // Create the base callable transformer function
  const callableTransformer = (
    ...args: [] | [Configuration]
  ):
    | Promise<ZephyrRspackConfig>
    | ((config: Configuration) => Promise<ZephyrRspackConfig>) => {
    if (args.length > 0) {
      // Called with config: withZephyr()(config)
      return configTransformer(args[0] ?? {});
    } else {
      // Called with no args: withZephyr()() - return config transformer
      return configTransformer;
    }
  };

  // If we're in rsbuild context AND not in a function call, return the plugin
  if (isCalledFromRsbuild() && !isInFunctionCall) {
    const plugin = createRsbuildPlugin(options);

    // Add the callable transformer properties to the plugin
    Object.defineProperty(plugin, 'call', {
      value: Function.prototype.call.bind(callableTransformer),
      writable: true,
      enumerable: false,
      configurable: true,
    });

    Object.defineProperty(plugin, 'apply', {
      value: Function.prototype.apply.bind(callableTransformer),
      writable: true,
      enumerable: false,
      configurable: true,
    });

    return plugin as ZephyrUniversal;
  }

  // For non-rsbuild contexts, add minimal RsbuildPlugin properties to the callable transformer
  Object.defineProperty(callableTransformer, 'name', {
    value: 'zephyr',
    writable: true,
    enumerable: true,
    configurable: true,
  });

  Object.defineProperty(callableTransformer, 'setup', {
    value: undefined,
    writable: true,
    enumerable: true,
    configurable: true,
  });

  return callableTransformer as ZephyrUniversal;
}

/** Processes rspack configuration with Zephyr integration */
async function processRspackConfiguration(
  config: Configuration,
  options?: ZephyrRspackPluginOptions
): Promise<ZephyrRspackConfig> {
  // Initialize required properties to ensure they are non-nullable
  const plugins = config.plugins || [];
  const module = config.module || { rules: [] };
  const resolve = config.resolve || {};
  const output = config.output || {};

  try {
    await applyZephyrConfiguration(
      { ...config, plugins },
      config.context || process.cwd(),
      options
    );
  } catch (error) {
    logFn('error', ZephyrError.format(error));
  }

  // Return a configuration that satisfies ZephyrRspackConfig
  return {
    ...config,
    plugins,
    module,
    resolve,
    output,
  };
}
