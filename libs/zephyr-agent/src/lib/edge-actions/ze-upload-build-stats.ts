import {
  ZE_API_ENDPOINT,
  ze_api_gateway,
  type ZephyrBuildStats,
} from 'zephyr-edge-contract';
import { createHash } from 'node:crypto';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import { MCP_BUILD_STATS_DEADLINE_MS, mapMcpBuildStatsRejection } from '../mcp';
import { getToken } from '../node-persist/token';

/** @returns Array of deployed tags and envs. Empty array when waitForDeployments is false */
export async function zeUploadBuildStats(dashData: ZephyrBuildStats): Promise<string[]> {
  // Add dots here to indicate this is an async operation
  ze_log.upload('Uploading build stats to Zephyr...', dashData);

  const token = await getToken();

  const url = new URL(ze_api_gateway.build_stats, ZE_API_ENDPOINT());
  const idempotencyKey = createHash('sha256')
    .update(`${dashData.id}\0${dashData.app.buildId}`)
    .digest('hex');

  const [ok, cause, res] = await makeRequest<{ status: string; targets?: string[] }>(
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
      // An MCP provider version is published synchronously so the API's validation
      // reaches the deployer: longer deadline, no 4xx retries, 4xx as a local build error.
      ...(dashData.mcp
        ? {
            deadlineMs: MCP_BUILD_STATS_DEADLINE_MS,
            retryClientErrors: false,
            mapErrorResponse: mapMcpBuildStatsRejection,
          }
        : {}),
    },
    JSON.stringify(dashData)
  );

  if (!ok && ZephyrError.is(cause, ZeErrors.ERR_DEPLOY_LOCAL_BUILD)) {
    throw cause;
  }
  // A 401 on an MCP version stays an authentication error (credentials were already
  // cleared by the transport) so the deployer is asked to log in, not to check the network.
  if (!ok && dashData.mcp && ZephyrError.is(cause, ZeErrors.ERR_AUTH_ERROR)) {
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

  ze_log.upload('Build stats uploaded to Zephyr...');

  return res.targets ?? [];
}
