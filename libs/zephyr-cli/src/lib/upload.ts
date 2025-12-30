import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import type { ZephyrEngine } from 'zephyr-agent';
import { logFn, ZephyrError } from 'zephyr-agent';
import { getBuildStats } from './build-stats';

export interface UploadOptions {
  zephyr_engine: ZephyrEngine;
  assetsMap: ZeBuildAssetsMap;
}

/**
 * Orchestrate the upload process:
 *
 * 1. Start a new build
 * 2. Upload assets with build stats
 * 3. Finish the build
 */
export async function uploadAssets(options: UploadOptions): Promise<void> {
  const { zephyr_engine, assetsMap } = options;

  try {
    // Start a new build
    await zephyr_engine.start_new_build();

    // Generate build stats
    const buildStats = await getBuildStats(zephyr_engine);

    // Upload assets and finish the build
    await zephyr_engine.upload_assets({
      assetsMap,
      buildStats,
    });

    await zephyr_engine.build_finished();
  } catch (error) {
    logFn('error', ZephyrError.format(error));
    throw error;
  }
}
