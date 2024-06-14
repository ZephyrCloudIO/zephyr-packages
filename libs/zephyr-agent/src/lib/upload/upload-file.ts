import { ClientRequestArgs } from 'node:http';
import { request, UploadableAsset } from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';

export async function uploadFile({
  hash,
  asset,
  application_uid,
}: {
  hash: string;
  asset: UploadableAsset;
  application_uid: string;
}): Promise<unknown> {
  const type = 'file';

  const { EDGE_URL, jwt } = await getApplicationConfiguration({
    application_uid,
  });

  const options: ClientRequestArgs = {
    method: 'POST',
    headers: {
      'x-file-size': asset.size.toString(),
      'x-file-path': asset.path,
      can_write_jwt: jwt,
      'Content-Type': 'application/octet-stream',
    },
  };

  const url = new URL('/upload', EDGE_URL);
  url.searchParams.append('type', type);
  url.searchParams.append('hash', hash);
  url.searchParams.append('filename', asset.path);
  return request(url, options, asset.buffer);
}
