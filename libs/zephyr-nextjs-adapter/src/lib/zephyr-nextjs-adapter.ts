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
} from './types';
import { getZephyrConfig, createLogger } from './utils';
import { convertToZephyrAssets, createSnapshot, uploadSnapshot } from './core';

/** Default Zephyr Next.js Adapter */
const zephyrNextJSAdapter: NextAdapter = {
  name: 'zephyr-nextjs-adapter',

  /** Modify Next.js configuration before build starts */
  modifyConfig: async (config: NextConfigComplete) => {
    const log = createLogger('modifyConfig');
    log.info('🚀 Zephyr Next.js Adapter: Configuring Next.js for Zephyr deployment...');

    // Auto-discover Zephyr configuration using same approach as other plugins
    const zephyrConfig = await getZephyrConfig();

    log.info('⚙️  Auto-discovered Zephyr Configuration:');
    log.info(`   - Organization: ${zephyrConfig.orgId || 'Auto-detected from git'}`);
    log.info(`   - Project: ${zephyrConfig.projectId || 'Auto-detected from git'}`);
    log.info(
      `   - Package: ${zephyrConfig.packageInfo?.name}@${zephyrConfig.packageInfo?.version}`
    );
    log.info(`   - Git Branch: ${zephyrConfig.gitInfo?.branch}`);
    log.info(`   - Environment: ${zephyrConfig.environment}`);

    // Apply Zephyr-specific Next.js configuration
    config.experimental = config.experimental || {};

    // Enable standalone output for proper asset extraction
    config.output = 'standalone';

    // Configure for module federation if enabled
    if (zephyrConfig.enableModuleFederation) {
      log.info('🔗 Enabling Module Federation support');
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
        const result = originalWebpack(webpackConfig, options);

        // Remove any existing Zephyr webpack plugins
        if (result.plugins) {
          const originalLength = result.plugins.length;
          result.plugins = result.plugins.filter(
            (plugin: { constructor: { name: string } }) =>
              !plugin.constructor.name.includes('Zephyr')
          );

          if (result.plugins.length < originalLength) {
            log.info('🔧 Removed Zephyr webpack plugins (using adapter instead)');
          }
        }

        return result;
      };
    }

    log.info('✅ Zephyr Next.js Adapter: Configuration completed');
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
    const log = createLogger('onBuildComplete');
    log.info('🎯 Zephyr Next.js Adapter: Build completed, creating final snapshot...');
    log.info(`📊 Total outputs to process: ${ctx.outputs.length}`);

    try {
      // Convert the Next.js adapter context to our legacy BuildContext for compatibility
      const legacyBuildContext = {
        routes: {
          headers: (ctx.routes.headers || []).map((route) => ({
            source: route.source || '',
            headers:
              route.headers && Array.isArray(route.headers)
                ? route.headers.reduce(
                    (acc, h) => ({ ...acc, [h.key]: h.value }),
                    {} as Record<string, string>
                  )
                : route.headers || {},
            has: route.has,
            missing: route.missing,
          })),
          redirects: (ctx.routes.redirects || []).map((route) => ({
            source: route.source || '',
            destination: route.destination || '',
            permanent: route.permanent,
            statusCode: route.statusCode,
            has: route.has,
            missing: route.missing,
          })),
          rewrites: {
            beforeFiles: (ctx.routes.rewrites?.beforeFiles || []).map((route) => ({
              source: route.source || '',
              destination: route.destination || '',
              has: route.has,
              missing: route.missing,
            })),
            afterFiles: (ctx.routes.rewrites?.afterFiles || []).map((route) => ({
              source: route.source || '',
              destination: route.destination || '',
              has: route.has,
              missing: route.missing,
            })),
            fallback: (ctx.routes.rewrites?.fallback || []).map((route) => ({
              source: route.source || '',
              destination: route.destination || '',
              has: route.has,
              missing: route.missing,
            })),
          },
          dynamicRoutes: (ctx.routes.dynamicRoutes || []).map(() => ({
            page: '',
            regex: '',
          })),
        },
        outputs: ctx.outputs,
      };

      // Convert Next.js adapter outputs to Zephyr asset format
      const zephyrAssets = await convertToZephyrAssets(legacyBuildContext, log);

      // Create the final Zephyr snapshot
      const snapshot = await createSnapshot(zephyrAssets, legacyBuildContext, log);

      // Upload the snapshot to Zephyr Cloud
      await uploadSnapshot(snapshot, log);

      log.info(
        '✨ Zephyr Next.js Adapter: Single snapshot created and uploaded successfully!'
      );
    } catch (error) {
      log.error('❌ Zephyr Next.js Adapter: Failed to create snapshot:', error);
      throw error;
    }
  },
};

export default zephyrNextJSAdapter;
