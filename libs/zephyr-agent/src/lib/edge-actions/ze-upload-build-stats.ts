import {
  ZE_API_ENDPOINT,
  ze_api_gateway,
  type ZephyrBuildStats,
} from 'zephyr-edge-contract';
import { ze_log } from '../logging';
import { dimmedName } from '../logging/debug';
import { getToken } from '../node-persist/token';
import { ZeHttpRequest } from '../http/ze-http-request';
import { ZeErrors, ZephyrError } from '../errors';

/** Returns true if build stats are uploaded successfully, false otherwise. */
export async function zeUploadBuildStats(dashData: ZephyrBuildStats): Promise<boolean> {
  // Add dots here to indicate this is an async operation
  ze_log(`${dimmedName} Uploading build stats to Zephyr...`);

  const token = await getToken();

  const url = new URL(ze_api_gateway.build_stats, ZE_API_ENDPOINT());

  const [ok, cause, res] = await ZeHttpRequest.from<{ status: string }>(
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

  ze_log('Build stats uploaded to Zephyr...');

  return true;
}
