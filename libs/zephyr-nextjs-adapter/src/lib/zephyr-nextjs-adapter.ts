/**
 * Zephyr Next.js Adapter
 *
 * The main adapter implementation that integrates with the Next.js build process and
 * creates a single snapshot after the entire build completes.
 */

import type {
  NextAdapter,
  NextConfigComplete,
  ManifestHeaderRoute,
  ManifestRedirectRoute,
  ManifestRewriteRoute,
  AdapterOutputs,
} from './types';
import { getZephyrConfig, createLogger, transformRoutes } from './utils';
import { convertToZephyrAssets, createSnapshot, uploadSnapshot } from './core';

/** Default Zephyr Next.js Adapter */
const zephyrNextJSAdapter: NextAdapter = {
  name: 'zephyr-nextjs-adapter',

  /** Modify Next.js configuration before build starts */
  modifyConfig: async (config: NextConfigComplete) => {
    const log = createLogger();

    // Use only Zephyr debug logging - no plain console outputs
    log.debug.init('Next.js adapter configuration started');

    // Auto-discover Zephyr configuration using same approach as other plugins
    const zephyrConfig = await getZephyrConfig();

    // Log configuration details using debug categories
    log.debug.config('Auto-discovered Zephyr Configuration', {
      organization: zephyrConfig.orgId,
      project: zephyrConfig.projectId,
      package: `${zephyrConfig.packageInfo?.name}@${zephyrConfig.packageInfo?.version}`,
      branch: zephyrConfig.gitInfo?.branch,
      environment: zephyrConfig.environment,
    });

    // Apply Zephyr-specific Next.js configuration
    config.experimental = config.experimental || {};

    // Enable standalone output for proper asset extraction
    config.output = 'standalone';

    // Configure for module federation if enabled
    if (zephyrConfig.enableModuleFederation) {
      log.debug.misc('Enabling Module Federation support');
      config.experimental.esmExternals = true;
      config.experimental.serverComponentsExternalPackages = [
        ...(config.experimental.serverComponentsExternalPackages || []),
        'zephyr-agent',
        'zephyr-edge-contract',
        'zephyr-xpack-internal',
      ];
    }

    // Remove any existing Zephyr webpack plugins to avoid conflicts
    if (config.webpack) {
      const originalWebpack = config.webpack;
      config.webpack = (webpackConfig: unknown, options: unknown) => {
        // Call original webpack config first
        const result = originalWebpack(webpackConfig, options) as Record<string, unknown>;

        // Remove any existing Zephyr webpack plugins
        const plugins = result['plugins'] as any[];
        if (plugins && Array.isArray(plugins)) {
          const originalLength = plugins.length;
          result['plugins'] = plugins.filter(
            (plugin: { constructor: { name: string } }) =>
              !plugin.constructor.name.includes('Zephyr')
          );

          if ((result['plugins'] as any[]).length < originalLength) {
            log.debug.misc('Removed conflicting Zephyr webpack plugins');
          }
        }

        return result;
      };
    }

    log.debug.init('Next.js adapter configuration completed');
    return config;
  },

  /**
   * Handle the complete build - this is where we create our single snapshot This runs
   * AFTER all compilation, pre-rendering, and asset generation is finished
   */
  onBuildComplete: async (ctx: {
    routes: {
      headers: Array<ManifestHeaderRoute>;
      redirects: Array<ManifestRedirectRoute>;
      rewrites: {
        beforeFiles: Array<ManifestRewriteRoute>;
        afterFiles: Array<ManifestRewriteRoute>;
        fallback: Array<ManifestRewriteRoute>;
      };
      dynamicRoutes: Array<Record<string, unknown>>;
    };
    outputs: AdapterOutputs;
  }) => {
    const log = createLogger();
    log.debug.init('Next.js build completed, creating Zephyr snapshot');
    log.debug.snapshot('Processing outputs', { count: ctx.outputs.length });

    try {
      // Convert the Next.js adapter context to our legacy BuildContext using functional transformation
      const legacyBuildContext = {
        routes: transformRoutes(ctx.routes),
        outputs: ctx.outputs,
      } as any;

      // Convert Next.js adapter outputs to Zephyr asset format
      const zephyrAssets = await convertToZephyrAssets(legacyBuildContext, log);

      // Create the final Zephyr snapshot
      const snapshot = await createSnapshot(zephyrAssets, legacyBuildContext, log);

      // Upload the snapshot to Zephyr Cloud
      await uploadSnapshot(snapshot, log);

      log.debug.upload('Snapshot created and uploaded successfully');
    } catch (error) {
      log.error('Failed to create Zephyr snapshot', error);
      throw error;
    }
  },
};

export default zephyrNextJSAdapter;
