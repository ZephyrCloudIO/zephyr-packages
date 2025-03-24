import {
  forEachLimit,
  type ZeBuildAsset,
  type ZeUploadAssetsOptions,
} from 'zephyr-edge-contract';
import { uploadFile } from '../http/upload-file';
import { ZephyrEngine } from '../../zephyr-engine';
import { white, whiteBright } from '../logging/picocolor';
import { ze_log } from '../logging';

const CLOUDFLARE_BATCH_SIZE = 6;

export async function zeUploadAssets(
  zephyr_engine: ZephyrEngine,
  { missingAssets, assetsMap }: ZeUploadAssetsOptions
): Promise<boolean> {
  const count = Object.keys(assetsMap).length;
  const logger = await zephyr_engine.logger;
  const appConfig = await zephyr_engine.application_configuration;

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

  // If the target is iOS or Android, we upload the assets in a 6 request batch to avoid cloudflare worker requests limit
  // Reference: https://developers.cloudflare.com/workers/platform/limits/#simultaneous-open-connections:~:text=Once%20an%20invocation%20has%20six%20connections%20open%2C%20it%20can%20still%20attempt%20to%20open%20additional%20connections.
  if (zephyr_engine.env.target !== 'ios' && zephyr_engine.env.target !== 'android') {
    await forEachLimit<void>(
      missingAssets.map((asset) => () => upload_missing_asset(asset)),
      1
    );
  } else {
    ze_log(
      "The target platform is 'ios' and 'android' so we are switching to batch upload."
    );
    await forEachLimit<void>(
      missingAssets.map((asset) => () => upload_missing_asset(asset)),
      CLOUDFLARE_BATCH_SIZE
    );
  }

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

  async function upload_missing_asset(asset: ZeBuildAsset): Promise<void> {
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
