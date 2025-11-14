/** Vite plugin for deploying TanStack Start applications to Zephyr */

import type { Plugin, ResolvedConfig, BuildEnvironment } from 'vite';
import type { RollupOutput, RollupWatcher } from 'rollup';

import * as path from 'path';
import {
  ZephyrEngine,
  type ZephyrEngineOptions,
  zeBuildDashData,
  buildAssetsMap,
} from 'zephyr-agent';
import { loadTanStackOutput } from './internal/extract/load-tanstack-output';

/** Extract buffer from Rollup output */
function extractBuffer(item: any): Buffer {
  if (item.type === 'chunk') {
    return Buffer.from(item.code, 'utf-8');
  } else if (item.type === 'asset') {
    if (typeof item.source === 'string') {
      return Buffer.from(item.source, 'utf-8');
    } else if (Buffer.isBuffer(item.source)) {
      return item.source;
    } else {
      return Buffer.from(item.source);
    }
  }
  return Buffer.from('');
}

/** Get asset type from Rollup output item */
function getAssetType(item: { fileName?: string; name?: string }): string {
  const fileName = item.fileName || item.name || '';
  const ext = path.extname(fileName).toLowerCase();
  const typeMap: Record<string, string> = {
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
  };
  return typeMap[ext] || 'application/octet-stream';
}

/**
 * Plugin options for TanStack Start Zephyr deployment All configuration is handled
 * automatically by ZephyrEngine via package.json and git info
 */
export interface TanStackStartZephyrOptions {
  /**
   * Optional output directory override Defaults to 'dist' relative to project root
   * (TanStack Start default)
   */
  outputDir?: string;
}

/**
 * Main Vite plugin for TanStack Start Zephyr deployment
 *
 * Configuration is automatically detected from:
 *
 * - Package.json (app name, version)
 * - Git info (org, project, branch)
 * - Zephyr auth (via ze login)
 */
export function withZephyrTanstackStart(
  options: TanStackStartZephyrOptions = {}
): Plugin {
  const { zephyr_engine_defer, zephyr_defer_create } = ZephyrEngine.defer_create();
  let config: ResolvedConfig;
  let outputDir: string;
  let uploadCompleted = false; // Guard to ensure we only upload once

  return {
    name: 'vite-plugin-tanstack-start-zephyr',
    enforce: 'post', // Run after TanStack Start plugin

    configResolved(resolvedConfig) {
      config = resolvedConfig;

      // For TanStack Start, always use the root dist directory (contains server/ and client/)
      // Don't use config.build.outDir as it points to dist/server/ during SSR build
      outputDir = options.outputDir || path.join(config.root, 'dist');

      console.log(`[TanStack Zephyr] Output directory: ${outputDir}`);
    },

    async buildApp(builder) {
      // Guard: Only process upload once, even if buildApp is called multiple times
      if (uploadCompleted) {
        return;
      }

      // Initialize ZephyrEngine in buildApp (runs once) instead of configResolved (runs per environment)
      // This ensures the engine is only created once, and start_new_build() is only called once
      // NOTE: ZephyrEngine.create() automatically calls start_new_build()
      const engineOptions: ZephyrEngineOptions = {
        builder: 'vite',
        context: config.root,
      };
      zephyr_defer_create(engineOptions);
      const zephyr_engine = await zephyr_engine_defer;
      // Log all environments and their build status for debugging
      const environments = Object.entries(builder.environments);
      console.log(
        `[TanStack Zephyr] buildApp hook called with ${environments.length} environment(s):`
      );
      for (const [name, env] of environments) {
        console.log(`  - ${name}: isBuilt=${env.isBuilt}`);
      }

      // Wait for all environments to be built (not just specific ones)
      // This ensures we have all build outputs before uploading
      const notBuilt = Object.entries(builder.environments)
        .filter(([, env]) => !env.isBuilt)
        .map(([name]) => name);

      if (notBuilt.length > 0) {
        console.log(
          `[TanStack Zephyr] Building environments that aren't built yet: ${notBuilt.join(', ')}`
        );
        for (const envName of notBuilt) {
          const env = builder.environments[envName];
          if (env) {
            await builder.build(env);
          }
        }
      }

      // Verify all environments are now built
      const allBuilt = Object.values(builder.environments).every((env) => env.isBuilt);
      if (!allBuilt) {
        const stillNotBuilt = Object.entries(builder.environments)
          .filter(([, env]) => !env.isBuilt)
          .map(([name]) => name);
        throw new Error(`Some environments are still not built: ${stillNotBuilt.join(', ')}`);
      }

      console.log('[TanStack Zephyr] All environments built, processing output...');

      try {
        // Engine is already initialized above, and ZephyrEngine.create() automatically calls start_new_build()
        // So we don't need to call start_new_build() again here

        // Load ALL build output preserving directory structure
        // This includes server/, client/, and any root files (favicon.ico, etc.)
        const bundle = await loadTanStackOutput(outputDir);

        const assetsMap = buildAssetsMap(bundle, extractBuffer, getAssetType);

        console.log(
          `[TanStack Zephyr] Uploading ${Object.keys(assetsMap).length} assets...`
        );

        // Upload assets with SSR snapshot type
        await zephyr_engine.upload_assets({
          assetsMap,
          buildStats: await zeBuildDashData(zephyr_engine),
          snapshotType: 'ssr',
        });

        // Finish build
        await zephyr_engine.build_finished();

        // Mark upload as completed to prevent multiple calls
        uploadCompleted = true;

        console.log('[TanStack Zephyr] Deployment successful!');
      } catch (error) {
        console.error('[TanStack Zephyr] Deployment failed:', error);
        throw error;
      }
    },
  };
}
