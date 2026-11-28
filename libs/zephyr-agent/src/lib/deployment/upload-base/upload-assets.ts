import { update_hash_list } from '../../edge-hash-list/distributed-hash-control';
import { zeUploadAssets } from '../../edge-actions/ze-upload-assets';
import type { ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../../zephyr-engine';

export interface UploadAssetsOptions {
  assetsMap: ZeBuildAssetsMap;
  missingAssets: ZeBuildAsset[];
  /** Hashes kept only in the edge's Object Storage bucket, never in its own storage. */
  storedHashes?: ReadonlySet<string>;
}

export async function uploadAssets(
  zephyr_engine: ZephyrEngine,
  { assetsMap, missingAssets, storedHashes }: UploadAssetsOptions
) {
  const upload_success = await zeUploadAssets(zephyr_engine, {
    missingAssets,
    assetsMap,
  });
  if (upload_success && missingAssets.length) {
    const application_uid = zephyr_engine.application_uid;
    // A bucket-only hash recorded here would be skipped by a later build against an
    // edge without a bucket, and that asset would 404.
    const hashes = Object.keys(assetsMap).filter((hash) => !storedHashes?.has(hash));
    await update_hash_list(application_uid, hashes);
  }

  return upload_success;
}
