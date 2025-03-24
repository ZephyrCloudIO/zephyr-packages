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

  console.log('body assets', body.assets);
  console.log('Object.entries(body.assets', Object.entries(body.assets));
  console.log('Object.fromEntries', Object.fromEntries(Object.entries(body.assets)));
  console.log('env uploadSnapshot', process.env['publicPath']);

  // // GAMBI
  body.assets = Object.fromEntries(
    Object.entries(body.assets).map(([key, value]) => {
      value.path = 'app/' + value.path;
      return ['app/' + key, value];
    })
  );
  console.log('body.assets after', body.assets);

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
