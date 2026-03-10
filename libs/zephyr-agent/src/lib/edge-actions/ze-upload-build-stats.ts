import {
  ZE_API_ENDPOINT,
  ze_api_gateway,
  type BuildStatsResponse,
  type ZephyrBuildStats,
} from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import { dimmedName } from '../logging/debug';
import { getToken } from '../node-persist/token';

/** Uploads build stats and returns deployment tracking metadata. */
export async function zeUploadBuildStats(
  dashData: ZephyrBuildStats
): Promise<{ status: 'ok' | 'accepted'; buildId: string | null }> {
  // Add dots here to indicate this is an async operation
  ze_log.upload(`${dimmedName} Uploading build stats to Zephyr...`);

  const token = await getToken();

  const url = new URL(ze_api_gateway.build_stats, ZE_API_ENDPOINT());

  const [ok, cause, res] = await makeRequest<BuildStatsResponse>(
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

  if (res.buildId) {
    ze_log.debug(
      `Received buildId ${res.buildId} from Zephyr for the uploaded build stats`
    );
  }

  ze_log.upload('Build stats uploaded to Zephyr...');

  return { status: res.status, buildId: res.buildId };
}
