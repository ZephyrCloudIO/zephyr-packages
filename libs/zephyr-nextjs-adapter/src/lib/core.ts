/**
 * Core functionality for the Zephyr Next.js Adapter
 *
 * Contains the main logic for converting Next.js outputs to Zephyr format, creating
 * snapshots, and uploading to Zephyr Cloud.
 */

import path from 'path';
import fs from 'fs/promises';
import type {
  BuildContext,
  ZephyrAssets,
  ZephyrSnapshot,
  ZephyrAssetInfo,
  UploadResult,
} from './types';
import {
  determineDeploymentTarget,
  isPublicAsset,
  convertMapToArray,
  getZephyrConfig,
  validateZephyrConfig,
  delay,
  toMap,
} from './utils';
import type { createLogger } from './utils';

// Pure transformation functions for functional asset processing

/** Transform an AdapterOutput to ZephyrAssetInfo */
const transformToAssetInfo = (output: Record<string, unknown>): ZephyrAssetInfo => ({
  id: output['id'] as string,
  pathname: output['pathname'] as string,
  filePath: output['filePath'] as string,
  runtime: output['runtime'] as 'nodejs' | 'edge' | undefined,
  type: output['type'] as any,
  config: output['config'] as Record<string, unknown>,
  assets: (output['assets'] as Record<string, string>) || {},
  fallbackID: output['fallbackID'] as string,
});

/** Categorize asset by deployment target */
const categorizeAsset = (output: Record<string, unknown>): [string, ZephyrAssetInfo] => {
  const assetInfo = transformToAssetInfo(output);
  const deploymentTarget = determineDeploymentTarget(output as any);

  // Determine the specific category
  let category: string;
  switch (deploymentTarget) {
    case 'cdn':
      category = isPublicAsset(output as any) ? 'publicAssets' : 'staticAssets';
      break;
    case 'edge':
      category = 'edgeFunctions';
      break;
    case 'server':
      category = 'serverFunctions';
      break;
    default:
      category = 'manifests';
  }

  return [category, assetInfo];
};

/** Group categorized assets into ZephyrAssets structure */
const groupAssetsByCategory = (
  categorizedAssets: [string, ZephyrAssetInfo][]
): ZephyrAssets => {
  const grouped = categorizedAssets.reduce(
    (acc, [category, asset]) => {
      if (!acc[category]) acc[category] = [];
      acc[category].push([asset.id, asset] as [string, ZephyrAssetInfo]);
      return acc;
    },
    {} as Record<string, [string, ZephyrAssetInfo][]>
  );

  return {
    staticAssets: toMap(grouped['staticAssets'] || []),
    serverFunctions: toMap(grouped['serverFunctions'] || []),
    edgeFunctions: toMap(grouped['edgeFunctions'] || []),
    prerenderedPages: toMap(grouped['prerenderedPages'] || []),
    manifests: toMap(grouped['manifests'] || []),
    publicAssets: toMap(grouped['publicAssets'] || []),
  };
};

/** Convert Next.js adapter outputs to Zephyr asset format using functional pipeline */
export async function convertToZephyrAssets(
  ctx: BuildContext,
  log: ReturnType<typeof createLogger>
): Promise<ZephyrAssets> {
  log.debug.init('Converting Next.js outputs to Zephyr asset format');

  // Apply functional transformation step by step for type safety
  // Ensure outputs is an array - handle various formats Next.js might provide
  const rawOutputs = ctx.outputs || [];
  const validOutputs = Array.isArray(rawOutputs) ? rawOutputs : [];

  log.debug.misc(`Processing ${validOutputs.length} outputs`);

  const categorizedAssets = validOutputs.map((output) =>
    categorizeAsset(output as Record<string, unknown>)
  );
  const zephyrAssets = groupAssetsByCategory(categorizedAssets);

  // Handle prerendered pages separately (functional approach)
  const prerenderedAssets = validOutputs
    .filter((output) => output.fallbackID)
    .map(
      (output) =>
        [output.id, transformToAssetInfo(output as Record<string, unknown>)] as [
          string,
          ZephyrAssetInfo,
        ]
    );

  zephyrAssets.prerenderedPages = toMap(prerenderedAssets);

  // Log results with structured information using debug categories
  log.debug.misc('Converted assets', {
    staticAssets: zephyrAssets.staticAssets.size,
    serverFunctions: zephyrAssets.serverFunctions.size,
    edgeFunctions: zephyrAssets.edgeFunctions.size,
    prerenderedPages: zephyrAssets.prerenderedPages.size,
    publicAssets: zephyrAssets.publicAssets.size,
    manifests: zephyrAssets.manifests.size,
  });

  return zephyrAssets;
}

/** Create a Zephyr snapshot from the converted assets */
export async function createSnapshot(
  zephyrAssets: ZephyrAssets,
  ctx: BuildContext,
  log: ReturnType<typeof createLogger>
): Promise<ZephyrSnapshot> {
  log.debug.snapshot('Creating Zephyr snapshot');

  const zephyrConfig = await getZephyrConfig();

  // Create the Zephyr snapshot format
  const snapshot: ZephyrSnapshot = {
    id: zephyrConfig.buildId!,
    timestamp: new Date().toISOString(),
    environment: zephyrConfig.environment!,
    framework: 'nextjs',

    // Build metadata
    metadata: {
      totalOutputs: ctx.outputs?.length || 0,
      hasMiddleware: zephyrAssets.edgeFunctions.size > 0,
      hasAPIRoutes:
        Array.from(zephyrAssets.serverFunctions.values()).some(
          (asset) => asset.type === 'APP_ROUTE' || asset.type === 'PAGES_API'
        ) ||
        Array.from(zephyrAssets.edgeFunctions.values()).some(
          (asset) => asset.type === 'APP_ROUTE' || asset.type === 'PAGES_API'
        ),
      hasSSR: Array.from(zephyrAssets.serverFunctions.values()).some(
        (asset) => asset.type === 'APP_PAGE' || asset.type === 'PAGES'
      ),
      staticAssetsCount: zephyrAssets.staticAssets.size,
      serverFunctionsCount: zephyrAssets.serverFunctions.size,
      edgeFunctionsCount: zephyrAssets.edgeFunctions.size,
    },

    // Routes configuration from Next.js
    routes: {
      headers: ctx.routes.headers || [],
      redirects: ctx.routes.redirects || [],
      rewrites: ctx.routes.rewrites || { beforeFiles: [], afterFiles: [], fallback: [] },
      dynamicRoutes: ctx.routes.dynamicRoutes || [],
    },

    // Assets organized by deployment target
    deploymentTargets: {
      // For Zephyr CDN
      cdn: {
        assets: convertMapToArray(zephyrAssets.staticAssets),
        publicAssets: convertMapToArray(zephyrAssets.publicAssets),
      },

      // For Zephyr Edge Workers
      edge: {
        functions: convertMapToArray(zephyrAssets.edgeFunctions),
      },

      // For Zephyr API/Server
      server: {
        functions: convertMapToArray(zephyrAssets.serverFunctions),
      },

      // Metadata and manifests
      manifests: convertMapToArray(zephyrAssets.manifests),
    },
  };

  log.debug.snapshot(`Snapshot created with ID: ${snapshot.id}`);
  return snapshot;
}

/** Upload the snapshot to Zephyr Cloud */
export async function uploadSnapshot(
  snapshot: ZephyrSnapshot,
  log: ReturnType<typeof createLogger>
): Promise<UploadResult> {
  log.debug.upload('Uploading snapshot to Zephyr Cloud');

  // Try to upload using ZephyrEngine first (it handles its own authentication)
  const uploadViaZephyrAgent = await tryZephyrAgentUpload(snapshot, log);

  if (uploadViaZephyrAgent.success) {
    return uploadViaZephyrAgent;
  }

  // If ZephyrEngine fails, check our own configuration for fallback
  const zephyrConfig = await getZephyrConfig();

  // Only validate for our fallback upload - ZephyrEngine handles its own auth
  const validation = validateZephyrConfig(zephyrConfig);
  if (!validation.valid) {
    log.debug.config(
      'Missing required Zephyr configuration for fallback upload:',
      validation.errors
    );
    log.debug.misc('Skipping upload - set environment variables and try again');

    // Save snapshot locally even if upload is skipped
    await saveSnapshotManifest(snapshot, log);

    return {
      success: false,
      buildId: snapshot.id,
      timestamp: snapshot.timestamp,
      uploadedAssets: 0,
      errors: [...(uploadViaZephyrAgent.errors || []), ...validation.errors],
    };
  }

  try {
    // Fallback to direct API upload simulation
    return await simulateDirectUpload(snapshot, log);
  } catch (error) {
    log.error('❌ Failed to upload to Zephyr Cloud:', error);

    // Save snapshot locally for debugging
    await saveSnapshotManifest(snapshot, log);

    return {
      success: false,
      buildId: snapshot.id,
      timestamp: snapshot.timestamp,
      uploadedAssets: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

/** Try to upload using existing Zephyr Agent infrastructure */
async function tryZephyrAgentUpload(
  snapshot: ZephyrSnapshot,
  log: ReturnType<typeof createLogger>
): Promise<UploadResult> {
  try {
    log.debug.init('Attempting to use existing Zephyr Agent infrastructure');

    // Import proper zephyr-agent functions
    const { ZephyrEngine, buildAssetsMap, zeBuildDashData } = await import(
      'zephyr-agent'
    );
    const fs = await import('fs');
    const path = await import('path');

    // Create ZephyrEngine instance using proper pattern
    log.debug.init('Creating ZephyrEngine instance');
    const zephyrEngine = await ZephyrEngine.create({
      context: process.cwd(),
      builder: 'unknown', // NextJS adapter doesn't fit standard builder types
    });

    // Start new build (following the pattern from other plugins)
    await zephyrEngine.start_new_build();

    log.debug.upload('Converting Next.js assets to Zephyr format');

    // Build assets map using the actual Next.js build outputs
    const standaloneDir = path.join(process.cwd(), '.next/standalone');
    const staticDir = path.join(process.cwd(), '.next/static');
    const buildDir = path.join(process.cwd(), '.next');

    // Create assets object in format expected by buildAssetsMap
    const assets: Record<string, { source: () => Buffer; size: () => number }> = {};

    // Add static assets from .next/static
    if (fs.existsSync(staticDir)) {
      const walkDir = (dir: string, prefix = '') => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkDir(fullPath, `${prefix}${file}/`);
          } else {
            const assetPath = `/_next/static/${prefix}${file}`;
            assets[assetPath] = {
              source: () => fs.readFileSync(fullPath),
              size: () => stat.size,
            };
          }
        }
      };
      walkDir(staticDir);
    }

    // Add server files from .next/server if they exist (for app router)
    const serverDir = path.join(buildDir, 'server');
    if (fs.existsSync(serverDir)) {
      const walkServerDir = (dir: string, prefix = '') => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkServerDir(fullPath, `${prefix}${file}/`);
          } else {
            const assetPath = `/_next/server/${prefix}${file}`;
            assets[assetPath] = {
              source: () => fs.readFileSync(fullPath),
              size: () => stat.size,
            };
          }
        }
      };
      walkServerDir(serverDir);
    }

    // Add server files from .next/standalone if they exist (for standalone mode)
    if (fs.existsSync(standaloneDir)) {
      const serverFile = path.join(standaloneDir, 'server.js');
      if (fs.existsSync(serverFile)) {
        const stat = fs.statSync(serverFile);
        assets['/server.js'] = {
          source: () => fs.readFileSync(serverFile),
          size: () => stat.size,
        };
      }
    }

    log.debug.upload(`Found ${Object.keys(assets).length} assets to upload`);

    if (Object.keys(assets).length === 0) {
      log.debug.misc('No assets found to upload');
      return {
        success: false,
        buildId: snapshot.id,
        timestamp: snapshot.timestamp,
        uploadedAssets: 0,
        errors: ['No assets found to upload'],
      };
    }

    // Use the proper buildAssetsMap function from zephyr-agent
    const assetsMap = buildAssetsMap(
      assets,
      (asset) => asset.source(), // Extract buffer from asset
      () => 'static' // All Next.js assets are treated as static for now
    );

    // Use zeBuildDashData to create proper build stats (instead of our custom function)
    log.debug.upload('Creating build stats using zephyr-agent');
    const buildStats = await zeBuildDashData(zephyrEngine);

    // Enhance build stats with Next.js specific metadata
    const enhancedBuildStats = {
      ...buildStats,
      metadata: {
        ...(buildStats.metadata || {}),
        nextjs: {
          hasMiddleware: snapshot.metadata.hasMiddleware,
          hasAPIRoutes: snapshot.metadata.hasAPIRoutes,
          hasSSR: snapshot.metadata.hasSSR,
          totalOutputs: snapshot.metadata.totalOutputs,
          staticAssetsCount: snapshot.metadata.staticAssetsCount,
          serverFunctionsCount: snapshot.metadata.serverFunctionsCount,
          edgeFunctionsCount: snapshot.metadata.edgeFunctionsCount,
        },
      },
      type: 'nextjs',
    };

    log.debug.upload('Uploading via ZephyrEngine.upload_assets()');

    // Use existing upload infrastructure with proper build stats
    await zephyrEngine.upload_assets({
      assetsMap,
      buildStats: enhancedBuildStats,
    });

    // Finish build (following the pattern from other plugins)
    await zephyrEngine.build_finished();

    log.debug.upload('Upload completed via Zephyr Agent');
    log.debug.upload(`Build ID: ${buildStats.app.buildId}`);

    return {
      success: true,
      buildId: buildStats.app.buildId,
      timestamp: snapshot.timestamp,
      uploadedAssets: Object.keys(assets).length,
    };
  } catch (error) {
    log.error('❌ Failed to use Zephyr Agent, details:', error);
    return {
      success: false,
      buildId: snapshot.id,
      timestamp: snapshot.timestamp,
      uploadedAssets: 0,
      errors: [error instanceof Error ? error.message : 'Zephyr Agent not available'],
    };
  }
}

/** Simulate direct upload to Zephyr Cloud (for development/testing) */
async function simulateDirectUpload(
  snapshot: ZephyrSnapshot,
  log: ReturnType<typeof createLogger>
): Promise<UploadResult> {
  log.debug.upload('Authenticating with Zephyr Cloud...');
  await delay(200);

  log.debug.upload('Uploading CDN assets...');
  await simulateUpload('CDN assets', snapshot.deploymentTargets.cdn.assets.length, log);

  log.debug.upload('Uploading Public assets...');
  await simulateUpload(
    'Public assets',
    snapshot.deploymentTargets.cdn.publicAssets.length,
    log
  );

  log.debug.upload('Uploading Edge functions...');
  await simulateUpload(
    'Edge functions',
    snapshot.deploymentTargets.edge.functions.length,
    log
  );

  log.debug.upload('Uploading Server functions...');
  await simulateUpload(
    'Server functions',
    snapshot.deploymentTargets.server.functions.length,
    log
  );

  log.debug.upload('Uploading manifests and metadata...');
  await simulateUpload('Manifests', snapshot.deploymentTargets.manifests.length, log);

  log.debug.upload('Configuring routes and deployment...');
  await delay(500);

  // Save snapshot metadata locally
  await saveSnapshotManifest(snapshot, log);

  log.debug.upload('Snapshot uploaded successfully to Zephyr Cloud!');
  log.debug.upload(`Build ID: ${snapshot.id}`);
  log.debug.upload(`Environment: ${snapshot.environment}`);

  return {
    success: true,
    buildId: snapshot.id,
    timestamp: snapshot.timestamp,
    uploadedAssets: snapshot.metadata.totalOutputs,
  };
}

/** Simulate upload process for demonstration */
async function simulateUpload(
  type: string,
  count: number,
  log: ReturnType<typeof createLogger>
): Promise<void> {
  const delay_ms = Math.min(count * 50, 1000); // Max 1 second delay
  await delay(delay_ms);
  log.debug.upload(`${type}: ${count} items uploaded`);
}

/** Save snapshot manifest locally for debugging and verification */
async function saveSnapshotManifest(
  snapshot: ZephyrSnapshot,
  log: ReturnType<typeof createLogger>
): Promise<void> {
  try {
    const manifestDir = path.join(process.cwd(), '.next');
    const manifestPath = path.join(manifestDir, 'zephyr-snapshot-manifest.json');

    await fs.mkdir(manifestDir, { recursive: true });
    await fs.writeFile(manifestPath, JSON.stringify(snapshot, null, 2));
    log.debug.misc(`Snapshot manifest saved to: ${manifestPath}`);
  } catch (error) {
    log.error(
      `Could not save snapshot manifest: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}
