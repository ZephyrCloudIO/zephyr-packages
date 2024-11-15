import { type ZeBuildAsset, type ZeUploadAssetsOptions } from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import { uploadFile } from '../http/upload-file';
import { ZephyrEngine } from '../../zephyr-engine';
import { white, whiteBright } from '../logging/picocolor';
import { ze_log } from '../logging';

export async function zeUploadAssets(
  zephyr_engine: ZephyrEngine,
  { missingAssets, assetsMap }: ZeUploadAssetsOptions
): Promise<boolean> {
  const count = Object.keys(assetsMap).length;
  const logger = await zephyr_engine.logger;
  const application_uid = zephyr_engine.application_uid;

  if (missingAssets.length === 0) {
    logger({
      level: 'info',
      action: 'snapshot:assets:upload:empty',
      message: `No assets to upload, ${white('skipping')}...`,
    });

    return true;
  }

  const start = Date.now();
  let totalSize = 0;

  const appConfig = await getApplicationConfiguration({
    application_uid,
  });

  await Promise.all(missingAssets.map(upload_missing_asset));

  logger({
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

    ze_log(
      `file ${asset.path} uploaded in ${fileUploaded}ms (${assetSize.toFixed(2)}kb)`
    );
  }
}
