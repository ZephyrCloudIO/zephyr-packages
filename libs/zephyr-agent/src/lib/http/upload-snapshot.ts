import type { Snapshot, SnapshotUploadRes } from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import { makeRequest } from './http-request';

export async function uploadSnapshot({
  body,
  application_uid,
}: {
  body: Snapshot;
  application_uid: string;
}): Promise<SnapshotUploadRes> {
  const { EDGE_URL, jwt, ENVIRONMENTS } = await getApplicationConfiguration({
    application_uid,
  });
  
  const json = JSON.stringify(body);
  ze_log.snapshot('Sending snapshot to edge:', JSON.stringify(body, null, 2));

  const resp = await doUploadSnapshotRequest({ json, edge_url: EDGE_URL, jwt})

  
  if (ENVIRONMENTS != null) {
    const env_edge_urls = Array.from(
      new Set(
        Object.values(ENVIRONMENTS)
          .filter((envCfg) => envCfg.edgeUrl !== EDGE_URL)
      )
    );
    await Promise.all(
      env_edge_urls.map(
        (envConfig) => doUploadSnapshotRequest({json, edge_url: envConfig.edgeUrl, jwt})
      )
    )
  }

  ze_log.snapshot('Done: snapshot uploaded...', body);

  return resp;
}

async function doUploadSnapshotRequest(
  {json, edge_url, jwt}: {json:string; edge_url: string; jwt: string;}
): Promise<SnapshotUploadRes> {
  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Length': Buffer.byteLength(json).toString(),
      'Content-Type': 'application/json; charset=utf-8',
      can_write_jwt: jwt,
    },
  };

  const url = new URL('/upload', edge_url);
  url.searchParams.append('type', 'snapshot');
  url.searchParams.append('skip_assets', 'true');
  ze_log.snapshot('Upload URL:', url.toString());

  const [ok, cause, resp] = await makeRequest<SnapshotUploadRes>(url, options, json);

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'snapshot',
      cause,
    });
  }

  return resp;
}
