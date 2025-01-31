import { Snapshot, SnapshotUploadRes } from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import { ZeHttpRequest } from './ze-http-request';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';

export async function uploadSnapshot({
  body,
  application_uid,
}: {
  body: Snapshot;
  application_uid: string;
}): Promise<SnapshotUploadRes> {
  const { EDGE_URL, jwt } = await getApplicationConfiguration({
    application_uid,
  });

  const json = JSON.stringify(body);

  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Length': Buffer.byteLength(json).toString(),
      'Content-Type': 'application/json; charset=utf-8',
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
    json
  );

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'snapshot',
      cause,
    });
  }

  ze_log('Done: snapshot uploaded...', body);

  return resp;
}
