import {
  ZE_API_ENDPOINT,
  ze_api_gateway,
  type ZephyrBuildStats,
} from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import { getToken } from '../node-persist/token';

/** @returns Array of deployed tags and envs. Empty array when waitForDeployments is false */
export async function zeUploadBuildStats(
  dashData: ZephyrBuildStats
): Promise<string[]> {
  // Add dots here to indicate this is an async operation
  ze_log.upload('Uploading build stats to Zephyr...', dashData);

  const token = await getToken();

  const url = new URL(ze_api_gateway.build_stats, ZE_API_ENDPOINT());

  const [ok, cause, res] = await makeRequest<{
    status: string;
    targets?: string[];
  }>(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    },
    JSON.stringify(dashData)
  );

  if (!ok || res.status !== 'ok') {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'build stats',
      cause,
      data: {
        url: url.toString(),
      },
    });
  }

  ze_log.upload('Build stats uploaded to Zephyr...');

  return res.targets ?? [];
}
