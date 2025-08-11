import { ze_log } from '../logging';
import type { UploadOptions, ZephyrEngine } from '../../zephyr-engine';
import { ZeErrors, ZephyrError } from '../errors';
import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import { makeRequest } from '../http/http-request';
import { zeUploadSnapshot } from '../edge-actions';
import { uploadAssets, uploadBuildStatsAndEnableEnvs } from './upload-base';

const EDGE_LAMBDA_MAX_BODY_SIZE = 788403; // floor(1024 * 1024 / 1.33), where 1.33 is size overhead of base64 encoding

export async function awsUploadStrategy(
  zephyr_engine: ZephyrEngine,
  { snapshot, getDashData, assets: { assetsMap, missingAssets } }: UploadOptions,
): Promise<string> {
  const snapshotSize = Buffer.byteLength(JSON.stringify(snapshot), 'utf8');
  if (snapshotSize > EDGE_LAMBDA_MAX_BODY_SIZE) {
    const opts = {
      entity_name: 'snapshot',
      entity_size: snapshotSize,
      max_allowed_size: EDGE_LAMBDA_MAX_BODY_SIZE,
    };
    throw new ZephyrError(ZeErrors.ERR_MAX_PAYLOAD_SIZE_EXCEEDED, opts);
  }

  for (const missingAsset of missingAssets) {
    if (missingAsset.size > EDGE_LAMBDA_MAX_BODY_SIZE) {
      const opts = {
        entity_name: missingAsset.path,
        entity_size: missingAsset.size,
        max_allowed_size: EDGE_LAMBDA_MAX_BODY_SIZE,
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
