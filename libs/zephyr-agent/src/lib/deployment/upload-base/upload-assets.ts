import { update_hash_list } from '../../edge-hash-list/distributed-hash-control';
import { zeUploadAssets } from '../../edge-actions/ze-upload-assets';
import { ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { ZephyrEngine } from '../../../zephyr-engine';

export interface UploadAssetsOptions {
  assetsMap: ZeBuildAssetsMap;
  missingAssets: ZeBuildAsset[];
}

export async function uploadAssets(
  zephyr_engine: ZephyrEngine,
  { assetsMap, missingAssets }: UploadAssetsOptions
) {
  const upload_success = await zeUploadAssets(zephyr_engine, {
    missingAssets,
    assetsMap,
  });
  if (upload_success && missingAssets.length) {
    const application_uid = zephyr_engine.application_uid;
    await update_hash_list(application_uid, assetsMap);
  }

  return upload_success;
}
