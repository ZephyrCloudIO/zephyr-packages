import type { ClientRequestArgs } from 'node:http';
import { type UploadableAsset, type ZeApplicationConfig, request } from 'zephyr-edge-contract';

export interface UploadFileProps {
  hash: string;
  asset: UploadableAsset;
}

export async function uploadFile({ hash, asset }: UploadFileProps, { EDGE_URL, jwt }: ZeApplicationConfig): Promise<unknown> {
  const type = 'file';

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
