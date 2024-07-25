import {
  yellow,
  ze_error,
  ze_log,
  type ZephyrPluginOptions,
  type ZeUploadAssetsOptions,
} from 'zephyr-edge-contract';
import { logger } from '../remote-logs/ze-log-event';
import { uploadFile } from '../upload/upload-file';

export async function zeUploadAssets(
  pluginOptions: ZephyrPluginOptions,
  { missingAssets, assetsMap, count }: ZeUploadAssetsOptions
): Promise<boolean> {
  const logEvent = logger(pluginOptions);

  if (missingAssets.length === 0) {
    logEvent({
      level: 'info',
      action: 'snapshot:assets:upload:empty',
      message: 'No new assets to upload',
    });

    return true;
  }

  logEvent({
    level: 'info',
    action: 'snapshot:assets:upload:started',
    message: `uploading missing assets to zephyr (queued ${missingAssets?.length} out of ${count})`,
  });

  let totalTime = 0;
  let totalSize = 0;

  const res = await Promise.all(
    missingAssets.map(async (asset) => {
      const start = Date.now();
      const assetWithBuffer = assetsMap[asset.hash];
      const assetSize = assetWithBuffer?.buffer?.length / 1024;
      return await uploadFile({
        hash: asset.hash,
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
        message: `Uploaded missing assets to zephyr (${yellow(
          missingAssets.length.toString()
        )} assets in ${yellow(totalTime.toString())}ms, ${yellow(totalSize.toFixed(2))}kb)`,
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

  if (!res) {
    ze_error('ZE20017', res);
  }

  return res;
}
