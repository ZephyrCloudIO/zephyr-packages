import {
  getToken,
  request,
  v2_api_paths,
  ze_error,
  ze_log,
  ZEPHYR_API_ENDPOINT,
  ZeUploadBuildStats,
} from 'zephyr-edge-contract';

export async function zeUploadBuildStats(
  dashData: unknown,
): Promise<{ value: ZeUploadBuildStats } | void> {
  ze_log('[zephyr]: Uploading build stats to Zephyr');
  const token = await getToken();
  const url = new URL(v2_api_paths.dashboard_path, ZEPHYR_API_ENDPOINT());
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
    JSON.stringify(dashData),
  ).catch((err) => {
    ze_error(
      `[zephyr]: If you believe this is a mistake please make sure you have access to the organization for this application in Zephyr. \n
      [zephyr]: Error uploading build stats, deployment is not completed. \n
      [zephyr]: Failed to upload build stats to Zephyr. \n
      `, err
    );
  });

  if (!res)
    return ze_error('Did not receive envs from build stats upload. Exiting.');

  if (typeof res === 'string')
    return ze_error('[zephyr]: Failed to upload build stats', res);

  ze_log('[zephyr]: Build stats uploaded to Zephyr');
  return res;
}
