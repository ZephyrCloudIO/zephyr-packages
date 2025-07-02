/**
 * Factory for creating custom Zephyr adapters
 *
 * Allows users to create custom adapters with specific configuration while maintaining
 * compatibility with the standard Zephyr infrastructure.
 */

import type {
  NextAdapter,
  NextConfigComplete,
  AdapterOutputs,
  ZephyrAdapterConfig,
  ManifestHeaderRoute,
  ManifestRedirectRoute,
  ManifestRewriteRoute,
  BuildContext,
} from './types';
import { getZephyrConfig, createLogger } from './utils';
import { convertToZephyrAssets, createSnapshot, uploadSnapshot } from './core';

/** Create a custom Zephyr adapter with specific configuration */
export function createZephyrAdapter(config: ZephyrAdapterConfig = {}): NextAdapter {
  const adapterName = `zephyr-custom-adapter-${Date.now()}`;

  return {
    name: adapterName,

    modifyConfig: async (nextConfig: NextConfigComplete) => {
      const log = createLogger('modifyConfig');

      // Call custom hook if provided
      if (config.onBuildStart) {
        await config.onBuildStart();
      }

      log.info(`🚀 ${adapterName}: Configuring Next.js for Zephyr deployment...`);

      // Auto-discover Zephyr configuration
      const zephyrConfig = await getZephyrConfig();

      if (config.enableDetailedLogging) {
        log.info('⚙️  Auto-discovered Zephyr Configuration:');
        log.info(`   - Organization: ${zephyrConfig.orgId || 'Auto-detected from git'}`);
        log.info(`   - Project: ${zephyrConfig.projectId || 'Auto-detected from git'}`);
        log.info(
          `   - Package: ${zephyrConfig.packageInfo?.name}@${zephyrConfig.packageInfo?.version}`
        );
        log.info(`   - Git Branch: ${zephyrConfig.gitInfo?.branch}`);
        log.info(`   - Environment: ${zephyrConfig.environment}`);
      }

      // Apply standard Zephyr configuration
      nextConfig.experimental = nextConfig.experimental || {};
      nextConfig.output = 'standalone';

      // Configure for module federation if enabled
      if (zephyrConfig.enableModuleFederation) {
        log.info('🔗 Enabling Module Federation support');
        nextConfig.experimental.esmExternals = true;
        nextConfig.experimental.serverComponentsExternalPackages = [
          ...(nextConfig.experimental.serverComponentsExternalPackages || []),
          'zephyr-agent',
          'zephyr-edge-contract',
          'zephyr-xpack-internal',
        ];
      }

      // Remove conflicting webpack plugins
      if (nextConfig.webpack) {
        const originalWebpack = nextConfig.webpack;
        nextConfig.webpack = (webpackConfig: unknown, options: unknown) => {
          const result = originalWebpack(webpackConfig, options) as any;

          if (result.plugins) {
            const originalLength = result.plugins.length;
            result.plugins = result.plugins.filter(
              (plugin: { constructor: { name: string } }) =>
                !plugin.constructor.name.includes('Zephyr')
            );

            if (result.plugins.length < originalLength) {
              log.info('🔧 Removed conflicting Zephyr webpack plugins');
            }
          }

          return result;
        };
      }

      log.info(`✅ ${adapterName}: Configuration completed`);
      return nextConfig;
    },

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

      log.info(`🎯 ${adapterName}: Build completed, processing outputs...`);
      log.info(`📊 Total outputs to process: ${ctx.outputs.length}`);

      try {
        // Apply custom asset filtering if provided
        let filteredOutputs = ctx.outputs;

        if (config.customAssetFilter) {
          const originalCount = filteredOutputs.length;
          filteredOutputs = filteredOutputs.filter(config.customAssetFilter);

          if (filteredOutputs.length < originalCount) {
            log.info(
              `🔍 Filtered ${originalCount - filteredOutputs.length} assets using custom filter`
            );
          }
        }

        // Apply exclude patterns if provided
        if (config.excludePatterns && config.excludePatterns.length > 0) {
          const originalCount = filteredOutputs.length;
          filteredOutputs = filteredOutputs.filter(
            (output) =>
              !config.excludePatterns?.some(
                (pattern) =>
                  output.pathname.includes(pattern) || output.filePath.includes(pattern)
              )
          );

          if (filteredOutputs.length < originalCount) {
            log.info(
              `🚫 Excluded ${originalCount - filteredOutputs.length} assets using exclude patterns`
            );
          }
        }

        // Convert to legacy BuildContext for compatibility
        const legacyBuildContext: BuildContext = {
          routes: {
            headers: ctx.routes.headers.map((route) => ({
              source: route.source || '',
              headers:
                route.headers?.reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {}) ||
                {},
              has: route.has,
              missing: route.missing,
            })),
            redirects: ctx.routes.redirects.map((route) => ({
              source: route.source || '',
              destination: route.destination || '',
              permanent: route.permanent,
              statusCode: route.statusCode,
              has: route.has,
              missing: route.missing,
            })),
            rewrites: {
              beforeFiles: ctx.routes.rewrites.beforeFiles.map((route) => ({
                source: route.source || '',
                destination: route.destination || '',
                has: route.has,
                missing: route.missing,
              })),
              afterFiles: ctx.routes.rewrites.afterFiles.map((route) => ({
                source: route.source || '',
                destination: route.destination || '',
                has: route.has,
                missing: route.missing,
              })),
              fallback: ctx.routes.rewrites.fallback.map((route) => ({
                source: route.source || '',
                destination: route.destination || '',
                has: route.has,
                missing: route.missing,
              })),
            },
            dynamicRoutes: ctx.routes.dynamicRoutes.map(() => ({ page: '', regex: '' })),
          },
          outputs: filteredOutputs,
        };

        // Convert Next.js outputs to Zephyr format
        const zephyrAssets = await convertToZephyrAssets(legacyBuildContext, log);

        // Create snapshot with custom metadata if provided
        const snapshot = await createSnapshot(zephyrAssets, legacyBuildContext, log);

        // Add custom metadata if provided
        if (config.customMetadata) {
          (snapshot as unknown as Record<string, unknown>)['customMetadata'] =
            config.customMetadata;
          log.info('📋 Added custom metadata to snapshot');
        }

        // Call custom hook before upload if provided
        if (config.onUploadStart) {
          await config.onUploadStart(snapshot);
        }

        // Handle custom upload logic or use default
        let uploadResult;

        if (config.onBuildComplete) {
          // Use custom build complete logic
          await config.onBuildComplete(legacyBuildContext);

          // Simulate successful upload result
          uploadResult = {
            success: true,
            buildId: snapshot.id,
            timestamp: snapshot.timestamp,
            uploadedAssets: legacyBuildContext.outputs.length,
          };
        } else {
          // Use default upload logic
          uploadResult = await uploadSnapshot(snapshot, log);
        }

        // Call custom hook after upload if provided
        if (config.onUploadComplete) {
          await config.onUploadComplete(uploadResult);
        }

        if (uploadResult.success) {
          log.info(`✨ ${adapterName}: Snapshot created and uploaded successfully!`);
        } else {
          log.warn(`⚠️  ${adapterName}: Upload completed with warnings`);
          if (uploadResult.errors) {
            uploadResult.errors.forEach((error) => log.warn(`   - ${error}`));
          }
        }
      } catch (error) {
        log.error(`❌ ${adapterName}: Failed to process build:`, error);
        throw error;
      }
    },
  };
}

/** Create a development adapter that skips uploads */
export function createDevelopmentAdapter(): NextAdapter {
  return createZephyrAdapter({
    onBuildComplete: async (ctx: BuildContext) => {
      const log = createLogger('development');
      log.info('🏗️  Development mode - skipping Zephyr upload');
      log.info(`📊 Build completed with ${ctx.outputs.length} outputs`);

      // Just log the outputs for debugging
      const outputsByType = ctx.outputs.reduce(
        (acc, output) => {
          acc[output.type] = (acc[output.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      log.info('📦 Output summary:');
      Object.entries(outputsByType).forEach(([type, count]) => {
        log.info(`   - ${type}: ${count}`);
      });
    },
  });
}

/** Create a production adapter with comprehensive logging */
export function createProductionAdapter(uploadBatchSize = 50): NextAdapter {
  return createZephyrAdapter({
    enableDetailedLogging: true,
    uploadBatchSize,
    customAssetFilter: (asset) => {
      // Filter out source maps in production
      return !asset.pathname.endsWith('.map');
    },
    excludePatterns: [
      '/_next/static/chunks/pages/_error',
      '/_next/static/chunks/pages/_app',
    ],
    customMetadata: {
      adapterVersion: '1.0.0',
      buildTimestamp: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
    },
  });
}

/** Create an adapter for CI/CD environments */
export function createCIAdapter(): NextAdapter {
  const isCI = process.env['CI'] === 'true';
  const buildNumber = process.env['BUILD_NUMBER'] || process.env['GITHUB_RUN_NUMBER'];

  return createZephyrAdapter({
    enableDetailedLogging: isCI,
    customMetadata: {
      isCI,
      buildNumber,
      gitCommit: process.env['GIT_COMMIT'] || process.env['GITHUB_SHA'],
      gitBranch: process.env['GIT_BRANCH'] || process.env['GITHUB_REF_NAME'],
      ciProvider: detectCIProvider(),
    },
    onUploadStart: async (snapshot) => {
      if (isCI) {
        console.log(`::notice::Starting Zephyr upload for build ${snapshot.id}`);
      }
    },
    onUploadComplete: async (result) => {
      if (isCI) {
        if (result.success) {
          console.log(
            `::notice::Zephyr upload completed successfully (${result.uploadedAssets} assets)`
          );
        } else {
          console.log(`::error::Zephyr upload failed: ${result.errors?.join(', ')}`);
        }
      }
    },
  });
}

/** Detect CI provider for metadata */
function detectCIProvider(): string {
  if (process.env['GITHUB_ACTIONS']) return 'GitHub Actions';
  if (process.env['GITLAB_CI']) return 'GitLab CI';
  if (process.env['JENKINS_URL']) return 'Jenkins';
  if (process.env['BUILDKITE']) return 'Buildkite';
  if (process.env['CIRCLECI']) return 'CircleCI';
  if (process.env['TRAVIS']) return 'Travis CI';
  if (process.env['VERCEL']) return 'Vercel';
  if (process.env['NETLIFY']) return 'Netlify';
  return 'Unknown';
}
