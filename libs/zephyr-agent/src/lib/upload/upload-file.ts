import type { ClientRequestArgs } from 'node:http';
import { type UploadableAsset, type ZeApplicationConfig, ZeErrors, ZeHttpRequest, ZephyrError } from 'zephyr-edge-contract';

export interface UploadFileProps {
  hash: string;
  asset: UploadableAsset;
}

export async function uploadFile({ hash, asset }: UploadFileProps, { EDGE_URL, jwt }: ZeApplicationConfig) {
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

  const [ok, cause] = await ZeHttpRequest.from(
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
