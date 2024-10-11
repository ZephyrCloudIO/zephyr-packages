import {
  type ZeBuildAsset,
  ZeErrors,
  type ZeUploadAssetsOptions,
  ZephyrError,
  type ZephyrPluginOptions,
  white,
  whiteBright,
  ze_log,
} from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';
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
      message: `No assets to upload, ${white('skipping')}...`,
    });

    return true;
  }

  const start = Date.now();
  let totalSize = 0;

  const appConfig = await getApplicationConfiguration({
    application_uid: pluginOptions.application_uid,
  });

  await Promise.all(missingAssets.map(upload_missing_asset));

  logEvent({
    level: 'info',
    action: 'snapshot:assets:upload:done',
    message: white(
      `(${whiteBright(
        missingAssets.length.toString()
      )}/${white(count.toString())} assets uploaded in ${whiteBright((Date.now() - start).toString())}ms, ${whiteBright(totalSize.toFixed(2))}kb)`
    ),
  });

  return true;

  async function upload_missing_asset(asset: ZeBuildAsset) {
    const start = Date.now();
    const assetWithBuffer = assetsMap[asset.hash];
    const assetSize = assetWithBuffer?.buffer?.length / 1024;

    await uploadFile(
      {
        hash: asset.hash,
        asset: assetWithBuffer,
      },
      appConfig
    );

    const fileUploaded = Date.now() - start;

    totalSize += assetSize;

    ze_log(`file ${asset.path} uploaded in ${fileUploaded}ms (${assetSize.toFixed(2)}kb)`);
  }
}
