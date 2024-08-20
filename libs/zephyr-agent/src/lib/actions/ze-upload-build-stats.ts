import {
  dimmedName,
  getToken,
  request,
  ZE_API_ENDPOINT,
  ze_api_gateway,
  ze_error,
  ze_log,
  ZephyrBuildStats,
  ZeUploadBuildStats,
} from 'zephyr-edge-contract';

export async function zeUploadBuildStats(dashData: ZephyrBuildStats): Promise<{ value: ZeUploadBuildStats } | void> {
  // Add dots here to indicate this is an async operation
  ze_log(`${dimmedName} Uploading build stats to Zephyr...`);
  const token = await getToken();
  const url = new URL(ze_api_gateway.build_stats, ZE_API_ENDPOINT());
  const res = await request<{ value: ZeUploadBuildStats }>(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
        Accept: 'application/json',
      },
    },
    JSON.stringify(dashData)
  ).catch((err) => {
    ze_error(
      'ERR_FAILED_UPLOAD_BUILD_STATS',
      `
If you believe this is a mistake please make sure you have access to the organization for this application in Zephyr.
Error uploading build stats, deployment is not completed....
      `.trim(),
      err
    );
  });

  if (!res) return ze_error('ERR_NOT_RECEIVE_ENVS_FROM_BUILD_STATS', 'Did not receive envs from build stats upload. Exiting...');

  if (typeof res === 'string') return ze_error('ERR_FAILED_UPLOAD_BUILD_STATS', 'Failed to upload build stats.', res);

  ze_log(`Build stats uploaded to Zephyr...`);
  return res;
}
