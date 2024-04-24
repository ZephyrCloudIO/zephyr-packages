import {
  ze_log,
  ZeUploadAssetsOptions,
  ZeWebpackPluginOptions,
} from 'zephyr-edge-contract';
import { logger } from '../remote-logs/ze-log-event';
import { uploadFile } from '../upload/upload-file';

export async function zeUploadAssets(
  pluginOptions: ZeWebpackPluginOptions,
  { missingAssets, assetsMap, count }: ZeUploadAssetsOptions
): Promise<boolean> {
  ze_log('Uploading assets.');
  const logEvent = logger(pluginOptions);

  if (
    !missingAssets?.assets ||
    Object.keys(missingAssets.assets).length === 0
  ) {
    logEvent({
      level: 'info',
      action: 'snapshot:assets:upload:empty',
      message: `no new assets to upload`,
    });
    return true;
  }

  logEvent({
    level: 'info',
    action: 'snapshot:assets:upload:started',
    message: `uploading missing assets to zephyr (queued ${missingAssets?.assets?.length} out of ${count})`,
  });

  let totalTime = 0;
  let totalSize = 0;
  const assets = Object.values(missingAssets.assets);

  return await Promise.all(
    assets.map(async (asset) => {
      const start = Date.now();
      const assetWithBuffer = assetsMap[asset.hash];
      const assetSize = assetWithBuffer?.buffer?.length / 1024;
      return await uploadFile({
        id: asset.hash,
        asset: assetWithBuffer,
        application_uid: pluginOptions.application_uid,
      })
        .then(() => {
          const fileUploaded = Date.now() - start;
          totalTime += fileUploaded;
          totalSize += assetSize;
          ze_log(
            `file ${asset.path} uploaded in ${fileUploaded}ms (${assetSize.toFixed(2)}kb)`
          );
        })
        .catch((err) => {
          logEvent({
            level: 'error',
            action: 'snapshot:assets:upload:file:failed',
            message: `failed to upload file ${asset.path} \n ${err.message.toString()}`,
          });

          throw err;
        });
    })
  )
    .then(() => {
      logEvent({
        level: 'info',
        action: 'snapshot:assets:upload:done',
        message: `uploaded missing assets to zephyr (${
          missingAssets?.assets?.length
        } assets in ${totalTime}ms, ${totalSize.toFixed(2)}kb)`,
      });
      return true;
    })
    .catch((err) => {
      logEvent({
        level: 'error',
        action: 'snapshot:assets:upload:failed',
        message: `failed uploading missing assets to zephyr \n ${err.message.toString()}`,
      });
      return false;
    });
}
