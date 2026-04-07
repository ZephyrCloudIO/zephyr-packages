import {
  forEachLimit,
  type ZeBuildAsset,
  type ZeBuildAssetsMap,
  type ZeUploadAssetsOptions,
} from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../zephyr-engine';
import { get_missing_assets } from '../edge-hash-list/get-missing-assets';
import { getApplicationHashList } from '../edge-requests/get-application-hash-list';
import { uploadFile } from '../http/upload-file';
import { ze_log } from '../logging';
import { white, whiteBright } from '../logging/picocolor';
import type {
  EnvironmentConfig,
  ZeApplicationConfig,
} from '../node-persist/upload-provider-options';

const MAX_MATCH_SIZE = 6;

export async function zeUploadAssets(
  zephyr_engine: ZephyrEngine,
  { missingAssets, assetsMap }: ZeUploadAssetsOptions
): Promise<boolean> {
  const count = Object.keys(assetsMap).length;
  const logger = await zephyr_engine.logger;
  const appConfig = await zephyr_engine.application_configuration;

  const envs = appConfig.ENVIRONMENTS;
  if (envs != null) {
    await Promise.all(
      Object.entries(envs)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .filter(([_, envCfg]) => envCfg.edgeUrl !== appConfig.EDGE_URL)
        .map(([env, envCfg]) => zeUploadAssetsForEnv(env, envCfg, appConfig, assetsMap))
    );
  }

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

  await forEachLimit<void>(
    missingAssets.map((asset) => () => upload_missing_asset(asset)),
    MAX_MATCH_SIZE
  );

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

    ze_log.upload(
      `file ${asset.path} uploaded in ${fileUploaded}ms (${assetSize.toFixed(2)}kb)`
    );
  }

  async function zeUploadAssetsForEnv(
    env: string,
    envCfg: EnvironmentConfig,
    appConfig: ZeApplicationConfig,
    assetsMap: ZeBuildAssetsMap
  ) {
    const hash_set = await getApplicationHashList({
      application_uid: zephyr_engine.application_uid,
      edge_url: envCfg.edgeUrl,
    });
    const missingAssets = get_missing_assets({
      assetsMap,
      hash_set: { hash_set: new Set(hash_set.hashes) },
    });
    if (missingAssets.length === 0) {
      return;
    }
    let totalSize = 0;
    await Promise.all(
      missingAssets.map(async (asset) => {
        ze_log.upload(`Uploading file ${asset.path} to env: ${whiteBright(env)}`);
        const start = Date.now();
        const assetWithBuffer = assetsMap[asset.hash];
        const assetSize = assetWithBuffer?.buffer?.length / 1024;

        await uploadFile(
          {
            hash: asset.hash,
            asset: assetWithBuffer,
          },
          { ...appConfig, EDGE_URL: envCfg.edgeUrl }
        );

        const fileUploaded = Date.now() - start;

        totalSize += assetSize;

        ze_log.upload(
          `file ${asset.path} uploaded in ${fileUploaded}ms (${assetSize.toFixed(2)}kb) for env: ${whiteBright(env)}`
        );
      })
    );
    ze_log.upload(
      `Total size uploaded for env: ${whiteBright(env)}: ${totalSize.toFixed(2)}kb`
    );
  }
}
