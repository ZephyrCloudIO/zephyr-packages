import type { ZeBuildAsset, ZeUploadAssetsOptions } from 'zephyr-edge-contract';
import { ze_log } from '../logging';
import type { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { ZeErrors, ZephyrError } from '../errors';
import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import { makeRequest } from '../http/http-request';
import { zeUploadSnapshot } from '../edge-actions';
import { type UploadAssetsOptions, uploadBuildStatsAndEnableEnvs } from './upload-base';
import { update_hash_list } from '../edge-hash-list/distributed-hash-control';
import { white, whiteBright } from '../logging/picocolor';
import type { UploadFileProps } from '../http/upload-file';
import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';

const AWS_MAX_BODY_SIZE = 20971520;

export async function awsUploadStrategy(
  zephyr_engine: ZephyrEngine,
  { snapshot, getDashData, assets: { assetsMap, missingAssets } }: UploadOptions
): Promise<string> {
  const snapshotSize = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
  if (snapshotSize > AWS_MAX_BODY_SIZE) {
    const opts = {
      entity_name: 'snapshot',
      entity_size: snapshotSize,
      max_allowed_size: AWS_MAX_BODY_SIZE,
    };
    throw new ZephyrError(ZeErrors.ERR_MAX_PAYLOAD_SIZE_EXCEEDED, opts);
  }

  for (const missingAsset of missingAssets) {
    if (missingAsset.size > AWS_MAX_BODY_SIZE) {
      const opts = {
        entity_name: missingAsset.path,
        entity_size: missingAsset.size,
        max_allowed_size: AWS_MAX_BODY_SIZE,
      };
      throw new ZephyrError(ZeErrors.ERR_MAX_PAYLOAD_SIZE_EXCEEDED, opts);
    }
  }

  await createBucket(zephyr_engine.application_uid);
  await uploadAssets(zephyr_engine, { assetsMap, missingAssets });
  const versionUrl = await zeUploadSnapshot(zephyr_engine, { snapshot });

  // Waits for the reply to check upload problems, but the reply is a simply
  // 200 OK sent before any processing
  await uploadBuildStatsAndEnableEnvs(zephyr_engine, { getDashData, versionUrl });

  return versionUrl;
}

export async function createBucket(application_uid: string): Promise<void> {
  const { EDGE_URL, jwt } = await getApplicationConfiguration({
    application_uid,
  });

  const options: RequestInit = {
    method: 'POST',
    headers: {
      can_write_jwt: jwt,
    },
  };

  const url = new URL('/upload', EDGE_URL);
  url.searchParams.append('type', 'bucket');

  const [ok, cause] = await makeRequest(url, options);

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'bucket',
      cause,
    });
  }

  ze_log.snapshot('Done: bucket initialized...');
}

async function uploadAssets(
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

async function zeUploadAssets(
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

  async function upload_missing_asset(asset: ZeBuildAsset): Promise<void> {
    const start = Date.now();
    const assetWithBuffer = assetsMap[asset.hash];
    const assetSize = assetWithBuffer?.buffer?.length / 1024;

    const result = await getUploadUrl(
      {
        hash: asset.hash,
        asset: assetWithBuffer,
      },
      appConfig
    );

    if (result.message) {
      // File exists
      return;
    }

    const [ok, cause] = await makeRequest(
      result.url,
      {
        method: 'PUT',
        headers: {
          'Content-Type': result.contentType,
        },
      },
      asset.buffer
    );

    if (!ok) {
      throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
        type: 'file',
        cause,
      });
    }

    const fileUploaded = Date.now() - start;

    totalSize += assetSize;

    ze_log.upload(
      `file ${asset.path} uploaded in ${fileUploaded}ms (${assetSize.toFixed(2)}kb)`
    );
  }

  async function getUploadUrl(
    { hash, asset }: UploadFileProps,
    { EDGE_URL, jwt }: ZeApplicationConfig
  ): Promise<{ url: string; contentType: string; message?: string }> {
    const type = 'uploadUrl';
    const options: RequestInit = {
      method: 'POST',
      headers: {
        'x-file-size': asset.size.toString(),
        'x-file-path': asset.path,
        can_write_jwt: jwt,
        'Content-Type': 'application/octet-stream',
      },
    };

    const [ok, cause, data] = await makeRequest<{ url: string; contentType: string }>(
      {
        path: '/upload',
        base: EDGE_URL,
        query: { type, hash, filename: asset.path },
      },
      options,
      asset.buffer
    );

    if (!ok) {
      throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
        type,
        cause,
      });
    }

    return data;
  }
}
