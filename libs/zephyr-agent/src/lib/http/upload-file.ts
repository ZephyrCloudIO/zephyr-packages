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
  { EDGE_URL, jwt, ENVIRONMENTS }: ZeApplicationConfig
) {
  await doUploadFileRequest({hash, asset, jwt, edge_url: EDGE_URL});
  if (ENVIRONMENTS != null) {
    const env_edge_urls = Array.from(
      new Set(Object.values(ENVIRONMENTS).filter((envCfg) => envCfg.edgeUrl !== EDGE_URL))
    );
    await Promise.all(
      env_edge_urls.map((envConfig) =>
        doUploadFileRequest({ hash, asset, edge_url: envConfig.edgeUrl, jwt })
      )
    );
  }
}

async function doUploadFileRequest(
  {hash, asset, jwt, edge_url}: {hash: string, asset: UploadableAsset; jwt: string; edge_url: string;}
): Promise<void> {
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
      base: edge_url,
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