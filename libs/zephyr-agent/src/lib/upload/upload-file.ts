import { ClientRequestArgs } from 'node:http';
import { request, UploadableAsset } from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../application-configuration/get-application-configuration';

export async function uploadFile({
  id,
  asset,
  application_uid,
}: {
  id: string;
  asset: UploadableAsset;
  application_uid: string;
}): Promise<unknown> {
  const type = 'file';
  const meta = {
    path: asset.path,
    extname: asset.extname,
    hash: asset.hash,
    size: asset.size,
    createdAt: Date.now(),
  };

  const { EDGE_URL, jwt } = await getApplicationConfiguration({
    application_uid,
  });

  const options: ClientRequestArgs = {
    method: 'POST',
    headers: {
      'x-file-size': asset.size.toString(),
      'x-file-path': asset.path,
      'x-file-meta': JSON.stringify(meta),
      can_write_jwt: jwt,
    },
  };

  const url = new URL('/upload', EDGE_URL);
  url.searchParams.append('type', type);
  url.searchParams.append('id', id);
  return request(url, options, asset.buffer);
}
