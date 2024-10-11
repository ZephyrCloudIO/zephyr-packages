import { ClientRequestArgs } from 'node:http';
import { Snapshot, SnapshotUploadRes, ze_log, ZeErrors, ZeHttpRequest, ZephyrError } from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';

export async function uploadSnapshot({ body, application_uid }: { body: Snapshot; application_uid: string }): Promise<SnapshotUploadRes> {
  const { EDGE_URL, jwt } = await getApplicationConfiguration({
    application_uid,
  });

  const data = JSON.stringify(body);

  const options: ClientRequestArgs = {
    method: 'POST',
    headers: {
      'Content-Length': data.length.toString(),
      'Content-Type': 'application/json',
      can_write_jwt: jwt,
    },
  };

  const [ok, cause, resp] = await ZeHttpRequest.from<SnapshotUploadRes>(
    {
      path: '/upload',
      base: EDGE_URL,
      query: {
        type: 'snapshot',
        skip_assets: true,
      },
    },
    options,
    data
  );

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'snapshot',
      cause,
    });
  }

  ze_log('Snapshot uploaded...');

  return resp;
}
