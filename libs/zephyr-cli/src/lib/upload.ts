import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import type { ZephyrEngine } from 'zephyr-agent';
import { logFn, ZephyrError } from 'zephyr-agent';
import { getBuildStats } from './build-stats';
import type { CliPublicationMetadata } from './publication-metadata';

export interface UploadOptions {
  zephyr_engine: ZephyrEngine;
  assetsMap: ZeBuildAssetsMap;
  /** Snapshot and dashboard Federation metadata supplied by the CLI sidecar. */
  publicationMetadata?: CliPublicationMetadata;
}

/**
 * Orchestrate the upload process:
 *
 * 1. Start a new build
 * 2. Upload assets with build stats
 * 3. Finish the build
 */
export async function uploadAssets(options: UploadOptions): Promise<void> {
  const { zephyr_engine, assetsMap, publicationMetadata } = options;
  // CLI commands pass an engine returned by create(), whose generation zero is active.
  let buildInProgress = true;

  try {
    // Start a new build
    await zephyr_engine.start_new_build();
    buildInProgress = true;

    // Generate build stats
    const buildStats = await getBuildStats(zephyr_engine);
    const buildStatsWithFederation = publicationMetadata?.federation
      ? { ...buildStats, federation: publicationMetadata.federation }
      : buildStats;

    // Upload assets and finish the build
    await zephyr_engine.upload_assets({
      assetsMap,
      buildStats: buildStatsWithFederation,
      ...(publicationMetadata?.mfConfig
        ? { mfConfig: publicationMetadata.mfConfig }
        : {}),
      ...(publicationMetadata?.mfConfigs
        ? { mfConfigs: publicationMetadata.mfConfigs }
        : {}),
    });

    buildInProgress = false;
    await zephyr_engine.build_finished();
  } catch (error) {
    logFn('error', ZephyrError.format(error));
    throw error;
  } finally {
    if (buildInProgress && zephyr_engine.hasActiveBuild !== false) {
      zephyr_engine.build_failed();
    }
  }
}
