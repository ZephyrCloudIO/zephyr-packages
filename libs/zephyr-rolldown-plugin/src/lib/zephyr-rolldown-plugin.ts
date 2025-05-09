import type {
  InputOptions,
  NormalizedOutputOptions,
  OutputBundle,
  Plugin,
} from 'rolldown';
import { ZephyrEngine } from 'zephyr-agent';
import { cwd } from 'node:process';
import { getAssetsMap } from './internal/get-assets-map';
import {
  extractRemoteDependencies,
  parseRemoteUrl,
} from './internal/extract-remote-dependencies';
import { updateRemoteUrls } from './internal/update-remote-urls';
import { buildDashboardData } from './internal/build-dashboard-data';
import { extractModuleFederationConfig } from './internal/extract-module-federation-config';
import path from 'node:path';

// Interface for the current Rolldown's ModuleFederation remote entry
export interface RolldownRemoteEntry {
  entry: string;
  name: string;
  entryGlobalName: string;
}

// Interface matching Rolldown's ModuleFederationPluginOption
export interface ModuleFederationOptions {
  name: string;
  filename?: string;
  exposes?: Record<string, string>;
  remotes?:
    | Array<RolldownRemoteEntry>
    | Array<Record<string, string>>
    | Record<string, string>;
  shared?: Record<
    string,
    {
      singleton?: boolean;
      requiredVersion?: string;
      strictVersion?: boolean;
      shareScope?: string;
    }
  >;
  runtimePlugins?: string[];
  manifest?:
    | boolean
    | {
        filePath?: string;
        disableAssetsAnalyze?: boolean;
        fileName?: string;
      };
  getPublicPath?: string;
}

const getInputFolder = (options: InputOptions): string => {
  if (typeof options.input === 'string') return options.input;
  if (Array.isArray(options.input)) return options.input[0];
  if (typeof options.input === 'object') return Object.values(options.input)[0];
  return cwd();
};

export interface WithZephyrOptions {
  /**
   * For future compatibility. Currently, you should use the native moduleFederationPlugin
   * from 'rolldown/experimental' instead, and apply the Zephyr plugin separately.
   *
   * @deprecated Use native moduleFederationPlugin instead
   */
  mfConfig?: never;

  /** Enable verbose logging for debugging */
  verbose?: boolean;
}

/**
 * Zephyr plugin for Rolldown
 *
 * This plugin integrates Rolldown with Zephyr Cloud for deployment tracking, asset
 * management, and module federation management.
 *
 * Usage with Module Federation:
 *
 * ```js
 * // Import both plugins separately
 * import { moduleFederationPlugin } from 'rolldown/experimental';
 * import { withZephyr } from 'zephyr-rolldown-plugin';
 *
 * export default defineConfig({
 *   plugins: [
 *     // First, add the native Module Federation plugin
 *     moduleFederationPlugin({
 *       name: 'my-app',
 *       // other MF configuration
 *     }),
 *
 *     // Then add the Zephyr plugin
 *     withZephyr(),
 *   ],
 * });
 * ```
 *
 * @param options Configuration options (reserved for future use)
 * @returns Rolldown plugin
 */
export function withZephyr(_options?: WithZephyrOptions): Plugin | Plugin[] {
  if (_options?.mfConfig) {
    console.warn(
      '[zephyr-rolldown-plugin] The mfConfig option is not supported. ' +
        "Please use the native moduleFederationPlugin from 'rolldown/experimental' instead."
    );
  }

  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  const plugins: Plugin[] = [];

  // Track whether we've processed dependencies yet
  let hasProcessedDependencies = false;
  let mfPluginCreated = false;
  // Store the MF config for later use
  let storedMfConfig: ModuleFederationOptions | undefined;

  // Add main Zephyr plugin
  plugins.push({
    name: 'with-zephyr',

    // Process options early to get a chance to modify the configuration
    async options(options) {
      const pathToExecutionDir = cwd();

      // Initialize the Zephyr engine
      zephyr_defer_create({
        builder: 'rollup', // Use 'rollup' as the builder type since 'rolldown' is similar
        context: pathToExecutionDir,
      });

      // Extract Module Federation configuration first to help with debugging
      console.log("Original input options in options hook:", JSON.stringify({
        plugins: Array.isArray(options.plugins)
          ? options.plugins.map(p => ({ name: (p as any).name }))
          : { name: (options.plugins as any)?.name }
      }, null, 2));

      storedMfConfig = extractModuleFederationConfig(options);
      console.log("[Zephyr][options hook] MF Config:", storedMfConfig);

      // Extract and resolve dependencies early to modify the configuration
      const zephyrEngine = await zephyr_engine_defer;
      const dependencyPairs = extractRemoteDependencies(options, pathToExecutionDir);
      console.log(dependencyPairs);

      if (dependencyPairs.length > 0) {
        const resolvedDependencies =
          await zephyrEngine.resolve_remote_dependencies(dependencyPairs);
        updateRemoteUrls(zephyrEngine, options, resolvedDependencies);
        hasProcessedDependencies = true;
      }
      // Return the modified options
      return options;
    },

    // Still keep the buildStart hook for compatibility
    async buildStart(options) {
      // Skip processing if we've already done it in the options hook
      if (hasProcessedDependencies) {
        console.log(
          '[Zephyr] 🔄 Skipping dependency processing in buildStart hook (already processed in options hook)'
        );
        return;
      }

      // Initialize the Zephyr engine if not done already
      console.log('[Zephyr] 🔍 Processing buildStart hook');
      const pathToExecutionDir = getInputFolder(options);

      if (!(await zephyr_engine_defer)) {
        console.log(
          '[Zephyr] 🚀 Initializing Zephyr engine with context:',
          pathToExecutionDir
        );
        zephyr_defer_create({
          builder: 'rollup',
          context: pathToExecutionDir,
        });
      } else {
        console.log('[Zephyr] ℹ️ Using previously initialized Zephyr engine');
      }

      // Extract and resolve remote dependencies
      const zephyrEngine = await zephyr_engine_defer;
      console.log('[Zephyr] 📦 Extracting dependencies from configuration...');
      const dependencyPairs = extractRemoteDependencies(options, pathToExecutionDir);

      if (dependencyPairs.length > 0) {
        console.log(
          '[Zephyr] 🔗 Found remote dependencies:',
          JSON.stringify(dependencyPairs, null, 2)
        );
        console.log('[Zephyr] 🔄 Resolving remote dependencies...');
        const resolvedDependencies =
          await zephyrEngine.resolve_remote_dependencies(dependencyPairs);
        console.log(
          '[Zephyr] ✅ Dependencies resolved:',
          JSON.stringify(resolvedDependencies, null, 2)
        );
        console.log('[Zephyr] 🔄 Updating remote URLs in configuration...');
        updateRemoteUrls(zephyrEngine, options, resolvedDependencies);
        console.log('[Zephyr] ✅ Remote URLs updated successfully');
      } else {
        console.log('[Zephyr] ℹ️ No remote dependencies found to process');
      }
    },

    async writeBundle(options: NormalizedOutputOptions, bundle: OutputBundle) {
      const zephyrEngine = await zephyr_engine_defer;
      await zephyrEngine.start_new_build();

      // Build and upload assets with module federation metadata
      // Try to access the input options in a TypeScript-safe way
      let inputOptions: InputOptions | undefined;
      try {
        // This is a workaround to access input options in Rolldown
        inputOptions = (this as any).options;
      } catch (e) {
        // Fallback if we can't access input options
        inputOptions = undefined;
      }

      // Use previously stored MF config or extract it again if needed
      const mfConfig = storedMfConfig || (inputOptions ? extractModuleFederationConfig(inputOptions) : undefined);
      console.log('[Zephyr] MF Config in writeBundle:', mfConfig);

      // Format the MF config for the snapshot to match ZephyrPluginOptions.mfConfig format
      let formattedRemotes: Record<string, string> = {};

      if (mfConfig && mfConfig.remotes) {
        // Handle array format (current Rolldown format)
        if (Array.isArray(mfConfig.remotes)) {
          // Convert array format to object format for the snapshot
          mfConfig.remotes.forEach(remote => {
            if (remote && typeof remote === 'object') {
              // For the current Rolldown format with entry/name/entryGlobalName
              if ('entry' in remote && ('name' in remote || 'entryGlobalName' in remote)) {
                const remoteName = (remote as any).entryGlobalName || (remote as any).name;
                const remoteUrl = (remote as any).entry;
                if (remoteName && remoteUrl) {
                  formattedRemotes[remoteName] = remoteUrl;
                }
              }
              // For the object format with key-value pairs
              else {
                Object.entries(remote).forEach(([key, value]) => {
                  formattedRemotes[key] = value as string;
                });
              }
            }
          });
        }
        // Handle object format
        else if (typeof mfConfig.remotes === 'object') {
          formattedRemotes = mfConfig.remotes as Record<string, string>;
        }
      }

      console.log('[Zephyr] Formatted remotes for snapshot:', formattedRemotes);

      const formattedMfConfig = mfConfig ? {
        name: mfConfig.name,
        filename: mfConfig.filename || 'remoteEntry.js',
        exposes: mfConfig.exposes,
        remotes: formattedRemotes,
        shared: mfConfig.shared as Record<string, unknown>,
        runtimePlugins: mfConfig.runtimePlugins
      } : undefined;

      await zephyrEngine.upload_assets({
        assetsMap: getAssetsMap(bundle),
        buildStats: await buildDashboardData(zephyrEngine, inputOptions),
        mfConfig: formattedMfConfig,
      });

      await zephyrEngine.build_finished();
    },
  });

  return plugins;
}
