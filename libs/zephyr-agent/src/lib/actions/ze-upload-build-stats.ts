import {
  ZE_API_ENDPOINT,
  type ZephyrBuildStats,
  dimmedName,
  getToken,
  request,
  ze_api_gateway,
  ze_error,
  ze_log,
} from 'zephyr-edge-contract';

const ERR_FAILED_UPLOAD_BUILD_STATS_MSG = `

If you believe this is a mistake please make sure you have access to the organization for this application in Zephyr.
Could not complete deployment...

`.trim();

/**
 * Returns true if build stats are uploaded successfully, false otherwise.
 */
export async function zeUploadBuildStats(dashData: ZephyrBuildStats): Promise<boolean> {
  // Add dots here to indicate this is an async operation
  ze_log(`${dimmedName} Uploading build stats to Zephyr...`);

  const token = await getToken();

  const url = new URL(ze_api_gateway.build_stats, ZE_API_ENDPOINT());

  try {
    const res = await request<{ status: string }>(
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

    // Check for invalid responses
    if (typeof res === 'string' || res.status !== 'ok') {
      throw res; // throw the error to be caught by the catch block
    }

    ze_log('Build stats uploaded to Zephyr...');

    return true;
  } catch (err) {
    ze_error('ERR_FAILED_UPLOAD_BUILD_STATS', ERR_FAILED_UPLOAD_BUILD_STATS_MSG, err);
    return false;
  }
}
