import { type UploadableAsset } from 'zephyr-edge-contract';
import { ZeApplicationConfig } from '../node-persist/upload-provider-options';
import { ZeHttpRequest } from './ze-http-request';
import { ZeErrors, ZephyrError } from '../errors';

export interface UploadFileProps {
  hash: string;
  asset: UploadableAsset;
}

export async function uploadFile(
  { hash, asset }: UploadFileProps,
  { EDGE_URL, jwt }: ZeApplicationConfig
) {
  console.log('env uploadFile', process.env['publicPath']);

  const type = 'file';

  const options: RequestInit = {
    method: 'POST',
    headers: {
      // 'x-file-size': asset.size.toString(),
      'x-file-path': 'app/' + asset.path,
      // 'x-file-path': asset.path,
      can_write_jwt: jwt,
      'Content-Type': 'application/octet-stream',
    },
  };

  const [ok, cause] = await ZeHttpRequest.from(
    {
      path: '/upload',
      base: EDGE_URL,
      query: { type, hash, filename: 'app/' + asset.path },
      // query: { type, hash, filename: asset.path },
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
