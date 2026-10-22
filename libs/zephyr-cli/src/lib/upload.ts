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

/** Where a finished upload is served. */
export interface UploadResult {
  /** The immutable URL of this version, or `null` when Zephyr returned none. */
  versionUrl: string | null;
  /** Tag and environment URLs this version now serves. */
  targetUrls: string[];
}

/**
 * Orchestrate the upload process:
 *
 * 1. Start a new build
 * 2. Upload assets with build stats
 * 3. Finish the build
 */
export async function uploadAssets(options: UploadOptions): Promise<UploadResult> {
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
    // build_finished() resets the engine's build state, URLs included.
    const result: UploadResult = {
      versionUrl: zephyr_engine.version_url ?? null,
      targetUrls: [...(zephyr_engine.target_urls ?? [])],
    };
    await zephyr_engine.build_finished();
    return result;
  } catch (error) {
    logFn('error', ZephyrError.format(error));
    throw error;
  } finally {
    if (buildInProgress && zephyr_engine.hasActiveBuild !== false) {
      zephyr_engine.build_failed();
    }
  }
}
