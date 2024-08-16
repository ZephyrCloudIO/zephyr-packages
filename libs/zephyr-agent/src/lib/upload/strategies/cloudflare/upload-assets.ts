import { update_hash_list } from '../../../dvcs/distributed-hash-control';
import { zeUploadAssets } from '../../../actions/ze-upload-assets';
import { ZeBuildAsset, ZeBuildAssetsMap, ZephyrPluginOptions } from 'zephyr-edge-contract';

interface UploadAssetsOptions {
  assetsMap: ZeBuildAssetsMap;
  missingAssets: ZeBuildAsset[];
  pluginOptions: ZephyrPluginOptions;
  count: number;
}

export async function uploadAssets({ assetsMap, missingAssets, pluginOptions, count }: UploadAssetsOptions) {
  const upload_success = await zeUploadAssets(pluginOptions, {
    missingAssets,
    assetsMap,
    count,
  });
  if (upload_success && missingAssets.length) {
    await update_hash_list(pluginOptions.application_uid, assetsMap);
  }

  return upload_success;
}
