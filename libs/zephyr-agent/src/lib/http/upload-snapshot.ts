import type { Snapshot, SnapshotUploadRes } from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import { makeRequest } from './http-request';
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
  console.log(
    '[HTTP_UPLOAD_SNAPSHOT] Sending snapshot to edge:',
    JSON.stringify(body, null, 2)
  );

  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Length': Buffer.byteLength(json).toString(),
      'Content-Type': 'application/json; charset=utf-8',
      can_write_jwt: jwt,
    },
  };

  const url = new URL('/upload', EDGE_URL);
  url.searchParams.append('type', 'snapshot');
  url.searchParams.append('skip_assets', 'true');
  console.log('[HTTP_UPLOAD_SNAPSHOT] Upload URL:', url.toString());

  const [ok, cause, resp] = await makeRequest<SnapshotUploadRes>(url, options, json);

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'snapshot',
      cause,
    });
  }

  ze_log.snapshot('Done: snapshot uploaded...', body);

  return resp;
}
