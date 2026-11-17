import { type UploadableAsset } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import {
  UploadProviderType,
  type ZeApplicationConfig,
} from '../node-persist/upload-provider-options';
import { getHttpErrorStatus } from './http-failure';
import { makeRequest } from './http-request';

const PAYLOAD_TOO_LARGE = 413;

export interface UploadFileProps {
  hash: string;
  asset: UploadableAsset;
}

/**
 * The edge's own storage cannot hold the file. The worker's explanation stays on the
 * cause and is shown as the reason.
 */
function fileTooLargeError(
  asset: UploadableAsset,
  platform: UploadProviderType,
  cause: Error
): ZephyrError<'ERR_FAILED_UPLOAD'> {
  const hint =
    platform === UploadProviderType.AKAMAI
      ? "Akamai EdgeKV cannot hold files that large. Files other than HTML, SVG and XML go to the integration's Object Storage bucket when its worker has one; otherwise make the file smaller."
      : 'The edge storage cannot hold files that large. Make the file smaller.';
  return new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
    type: `file "${asset.path}" (${asset.size} bytes)`,
    cause,
    data: { hint },
  });
}

export async function uploadFile(
  { hash, asset }: UploadFileProps,
  { EDGE_URL, jwt, PLATFORM }: ZeApplicationConfig
) {
  const type = 'file';

  const options: RequestInit = {
    method: 'POST',
    headers: {
      'x-file-size': asset.size.toString(),
      'x-file-path': asset.path,
      can_write_jwt: jwt,
      'Content-Type': 'application/octet-stream',
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
    if (getHttpErrorStatus(cause) === PAYLOAD_TOO_LARGE) {
      throw fileTooLargeError(asset, PLATFORM, cause);
    }
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'file',
      cause,
    });
  }
}
