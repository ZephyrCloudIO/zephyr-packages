import { ClientRequestArgs } from 'node:http';
import {
  request,
  Snapshot,
  SnapshotUploadRes,
  ze_error,
  ze_log,
} from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';

export async function uploadSnapshot({
  body,
  application_uid,
}: {
  body: Snapshot;
  application_uid: string;
}): Promise<SnapshotUploadRes | undefined> {
  const { EDGE_URL, jwt } = await getApplicationConfiguration({
    application_uid,
  });

  const type = 'snapshot';
  const data = JSON.stringify(body);
  const url = new URL('/upload', EDGE_URL);
  url.searchParams.append('type', type);
  url.searchParams.append('skip_assets', 'true');
  const options: ClientRequestArgs = {
    method: 'POST',
    headers: {
      'Content-Length': data.length.toString(),
      'Content-Type': 'application/json',
      can_write_jwt: jwt,
    },
  };

  const res = await request<SnapshotUploadRes>(url, options, data).catch(
    (err) => ze_error("DE10018", 'Failed to upload snapshot.', err)
  );
  ze_log('Snapshot uploaded...');

  if (!res || typeof res === 'string') {
    ze_error("DE10018", 'Failed to upload snapshot.', res);
    return;
  }

  return res;
}
