import {
  ze_log,
  ZeUploadBuildStats,
  request,
  ze_error,
} from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';
import type { ClientRequestArgs } from 'node:http';

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
  const data = JSON.stringify({
    ...envs_jwt,
    pages_url,
  });

  const { EDGE_URL, jwt } = await getApplicationConfiguration({
    application_uid,
  });

  const url = new URL('/upload', EDGE_URL);
  url.searchParams.append('type', type);
  const options: ClientRequestArgs = {
    method: 'POST',
    headers: {
      can_write_jwt: jwt,
      'Content-Type': 'application/json',
      'Content-Length': data.length.toString(),
    },
  };

  const uploadResult = await request(url, options, data);
  if (!uploadResult) {
    ze_error('failed deploying local build to pages');
    return;
  }

  ze_log('Build successfully deployed to pages');
}
