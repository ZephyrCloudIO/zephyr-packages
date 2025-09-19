import { type UploadableAsset } from 'zephyr-edge-contract';
import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';
import { makeRequest } from './http-request';
import { ZeErrors, ZephyrError } from '../errors';

export interface UploadFileProps {
  hash: string;
  asset: UploadableAsset;
}

export async function uploadFile(
  { hash, asset }: UploadFileProps,
  { EDGE_URL, jwt, replicationTarget }: ZeApplicationConfig
) {
  const type = 'file';

  const options: RequestInit = {
    method: 'POST',
    headers: {
      'x-file-size': asset.size.toString(),
      'x-file-path': asset.path,
      can_write_jwt: jwt,
      'Content-Type': 'application/octet-stream',
      // Include replication target for worker to use
      ...(replicationTarget && {
        'x-replication-target': JSON.stringify(replicationTarget),
      }),
    },
  };

  const [ok, cause] = await makeRequest(
    {
      path: '/upload',
      base: EDGE_URL,
      query: { type, hash, filename: asset.path },
    },
    options,
    asset.buffer
  );

  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'file',
      cause,
    });
  }
}
