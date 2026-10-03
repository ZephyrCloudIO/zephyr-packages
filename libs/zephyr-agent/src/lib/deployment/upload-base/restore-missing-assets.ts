import {
  forEachLimit,
  type ZeBuildAsset,
  type ZeBuildAssetsMap,
} from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../../zephyr-engine';
import { remove_hashes_from_hash_list } from '../../edge-hash-list/distributed-hash-control';
import { ZeErrors, ZephyrError } from '../../errors';
import { uploadFile } from '../../http/upload-file';
import type {
  OnSnapshotMissingAssets,
  SnapshotMissingAssets,
} from '../../http/upload-snapshot';
import { ze_log } from '../../logging';
import { white, whiteBright } from '../../logging/picocolor';

const MAX_RESTORE_CONCURRENCY = 6;
/** Upper bound of hashes attached to error data, so terminal output stays readable. */
const MAX_REPORTED_HASHES = 20;

/** Uploads the given build assets to a specific edge. */
export type UploadAssetsToEdge = (
  assets: ZeBuildAsset[],
  edgeUrl: string
) => Promise<void>;

interface RestoreMissingAssetsOptions {
  assetsMap: ZeBuildAssetsMap;
  /** Strategy-specific upload of the restored assets. */
  uploadAssetsToEdge: UploadAssetsToEdge;
  /**
   * Settles before the local hash cache is touched, e.g. an in-flight asset upload that
   * would otherwise re-add the invalidated hashes to the cache afterwards.
   */
  beforeRestore?: () => Promise<unknown>;
}

/**
 * Creates the snapshot `missing_assets` handler: Zephyr build retention may delete files
 * the local hash cache still lists as uploaded. The handler invalidates those hashes
 * locally and uploads exactly the reported files so the snapshot upload can be retried.
 */
export function createMissingAssetsHandler(
  zephyr_engine: ZephyrEngine,
  { assetsMap, uploadAssetsToEdge, beforeRestore }: RestoreMissingAssetsOptions
): OnSnapshotMissingAssets {
  return async ({ hashes, edgeUrl }: SnapshotMissingAssets) => {
    await beforeRestore?.();

    await remove_hashes_from_hash_list(zephyr_engine.application_uid, hashes);

    const unknownHashes = hashes.filter((hash) => !assetsMap[hash]);
    if (unknownHashes.length) {
      throw new ZephyrError(ZeErrors.ERR_SNAPSHOT_MISSING_ASSETS_NOT_IN_BUILD, {
        count: unknownHashes.length,
        data: { missing_hashes: unknownHashes.slice(0, MAX_REPORTED_HASHES) },
      });
    }

    const logger = await zephyr_engine.logger;
    logger({
      level: 'warn',
      action: 'snapshot:assets:restore',
      message: `${whiteBright(hashes.length.toString())} file(s) were removed by Zephyr build retention, ${white('re-uploading')}...`,
    });

    const start = Date.now();
    await uploadAssetsToEdge(
      hashes.map((hash) => assetsMap[hash]),
      edgeUrl
    );

    ze_log.upload(
      `Restored ${hashes.length} missing asset(s) on ${edgeUrl} in ${Date.now() - start}ms`
    );
  };
}

/** Uploads assets to a specific edge through the regular file upload endpoint. */
export async function uploadAssetsToEdge(
  zephyr_engine: ZephyrEngine,
  assets: ZeBuildAsset[],
  edgeUrl: string
): Promise<void> {
  const appConfig = await zephyr_engine.application_configuration;

  await forEachLimit<void>(
    assets.map((asset) => async () => {
      await uploadFile({ hash: asset.hash, asset }, { ...appConfig, EDGE_URL: edgeUrl });
      ze_log.upload(`file ${asset.path} re-uploaded to ${edgeUrl}`);
    }),
    MAX_RESTORE_CONCURRENCY
  );
}
