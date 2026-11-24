import {
  ZE_API_ENDPOINT,
  ze_api_gateway,
  type BuildStatsResponse,
  type ZephyrBuildStats,
} from 'zephyr-edge-contract';
import { createHash } from 'node:crypto';
import { deployDeniedError, isDeniedOutcome } from '../deployment/deploy-denied';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import { getToken } from '../node-persist/token';

/**
 * @returns Array of deployed tags and envs. Empty unless the upload waits for deployments
 *   (`waitForCompletion`, set by `ZE_WAIT_FOR_DEPLOYMENTS`)
 * @throws {@link ZephyrError} `ERR_DEPLOY_DENIED` when a permission profile denied the
 *   deploy: the version is kept, and none of the app's tags or environments moved.
 */
export async function zeUploadBuildStats(dashData: ZephyrBuildStats): Promise<string[]> {
  ze_log.upload('Uploading build stats to Zephyr...', dashData);

  const token = await getToken();

  const url = new URL(ze_api_gateway.build_stats, ZE_API_ENDPOINT());
  const idempotencyKey = createHash('sha256')
    .update(`${dashData.id}\0${dashData.app.buildId}`)
    .digest('hex');

  const [ok, cause, res] = await makeRequest<BuildStatsResponse>(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      credentialToken: token,
    },
    JSON.stringify(dashData)
  );

  // A refusal from a permission profile is final: report it as is.
  if (!ok && ZephyrError.is(cause, ZeErrors.ERR_DEPLOY_DENIED)) {
    throw cause;
  }

  if (!ok || res.status !== 'ok') {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'build stats',
      cause,
      data: {
        url: url.toString(),
      },
    });
  }

  // The API kept the version but moved nothing of the app
  // (ZephyrCloudIO/zephyr-cloud-io#4004). Only `result` decides.
  if (isDeniedOutcome(res.outcome)) {
    throw deployDeniedError(
      { name: dashData.app.name, uid: dashData.id },
      { outcome: res.outcome, ignoredEnvs: res.ignoredEnvs }
    );
  }

  ze_log.upload('Build stats uploaded to Zephyr...');

  return res.targets ?? [];
}
