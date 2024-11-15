import { type ZeUploadBuildStats } from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import { ze_log } from '../logging';
import { ZeHttpRequest } from '../http/ze-http-request';
import { ZeErrors, ZephyrError } from '../errors';

interface ZeEnableSnapshotOnEdgeProps {
  pluginOptions: { application_uid: string };
  envs_jwt: ZeUploadBuildStats;
  pages_url: string;
}

export async function zeEnableSnapshotOnPages({
  pluginOptions: { application_uid },
  envs_jwt,
  pages_url,
}: ZeEnableSnapshotOnEdgeProps): Promise<void> {
  ze_log('Enabling snapshot on cloudflare pages');
  ze_log(`Uploading envs to Zephyr, for ${application_uid}`);

  const type = 'pages';
  const json = JSON.stringify({
    ...envs_jwt,
    pages_url,
  });

  const { EDGE_URL, jwt } = await getApplicationConfiguration({
    application_uid,
  });

  const [ok, cause] = await ZeHttpRequest.from(
    {
      path: '/upload',
      base: EDGE_URL,
      query: { type },
    },
    {
      method: 'POST',
      headers: {
        'Content-Length': Buffer.byteLength(json),
        'Content-Type': 'application/json; charset=utf-8',
        can_write_jwt: jwt,
      },
    },
    json
  );

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, { cause });
  }

  ze_log('Build successfully deployed.');
}
