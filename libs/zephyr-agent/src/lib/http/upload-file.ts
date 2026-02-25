import { type UploadableAsset } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';
import { makeRequest } from './http-request';

export interface UploadFileProps {
  hash: string;
  asset: UploadableAsset;
}

export async function uploadFile(
  { hash, asset }: UploadFileProps,
  { EDGE_URL, jwt, replicationTarget }: ZeApplicationConfig
) {
  const type = 'file';

  // Many servers/proxies enforce ~8KB total header size limits; keep this header conservative
  // to avoid HTTP 431 (Request Header Fields Too Large).
  const MAX_REPLICATION_TARGET_HEADER_BYTES = 8 * 1024;

  const replicationTargetHeader = replicationTarget
    ? JSON.stringify(replicationTarget)
    : undefined;

  if (replicationTargetHeader) {
    const bytes = new TextEncoder().encode(replicationTargetHeader).byteLength;

    if (bytes > MAX_REPLICATION_TARGET_HEADER_BYTES) {
      throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
        type: 'file',
        cause: new Error(
          `Replication target header too large (${bytes} bytes > ${MAX_REPLICATION_TARGET_HEADER_BYTES} bytes); consider sending this configuration via an alternative channel (e.g. request body) instead of HTTP headers.`
        ),
      });
    }
  }

  const options: RequestInit = {
    method: 'POST',
    headers: {
      'x-file-size': asset.size.toString(),
      'x-file-path': asset.path,
      can_write_jwt: jwt,
      'Content-Type': 'application/octet-stream',
      // Include replication target for worker to use
      ...(replicationTargetHeader && {
        'x-replication-target': replicationTargetHeader,
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
