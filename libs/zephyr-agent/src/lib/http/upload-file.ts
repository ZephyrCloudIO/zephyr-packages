import { type UploadableAsset } from 'zephyr-edge-contract';
import {
  type AuthRefreshContext,
  isForbiddenAuthError,
  isRetryableAuthError,
  refreshApplicationConfiguration,
} from '../auth/refresh-auth';
import { isTokenStillValid } from '../auth/login';
import { ZeErrors, ZephyrError } from '../errors';
import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';
import { makeRequest } from './http-request';

export interface UploadFileProps {
  hash: string;
  asset: UploadableAsset;
}

export type UploadFileAuthContext = AuthRefreshContext;

export async function uploadFile(
  { hash, asset }: UploadFileProps,
  applicationConfig: ZeApplicationConfig,
  authContext: UploadFileAuthContext
) {
  const targetEdgeUrl = applicationConfig.EDGE_URL;
  let currentConfig = applicationConfig;

  if (!isTokenStillValid(currentConfig.jwt)) {
    currentConfig = await refreshAuthAndConfig(
      authContext,
      targetEdgeUrl,
      ZeErrors.ERR_JWT_INVALID
    );
  }

  const type = 'file';

  const options: RequestInit = {
    method: 'POST',
    headers: {
      'x-file-size': asset.size.toString(),
      'x-file-path': asset.path,
      can_write_jwt: currentConfig.jwt,
      'Content-Type': 'application/octet-stream',
    },
  };

  let [ok, cause] = await makeRequest(
    {
      path: '/upload',
      base: targetEdgeUrl,
      query: { type, hash, filename: asset.path },
    },
    options,
    asset.buffer
  );

  if (!ok && isRetryableAuthError(cause)) {
    currentConfig = await refreshAuthAndConfig(
      authContext,
      targetEdgeUrl,
      ZeErrors.ERR_JWT_INVALID,
      {
        cause,
      }
    );

    const retryOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        can_write_jwt: currentConfig.jwt,
      },
    };

    [ok, cause] = await makeRequest(
      {
        path: '/upload',
        base: targetEdgeUrl,
        query: { type, hash, filename: asset.path },
      },
      retryOptions,
      asset.buffer
    );
  }

  if (!ok) {
    if (isForbiddenAuthError(cause)) {
      throw cause;
    }

    if (isRetryableAuthError(cause)) {
      throw new ZephyrError(ZeErrors.ERR_JWT_INVALID, {
        cause,
      });
    }
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'file',
      cause,
    });
  }
}

async function refreshAuthAndConfig(
  authContext: UploadFileAuthContext,
  targetEdgeUrl: string,
  errorType: typeof ZeErrors.ERR_JWT_INVALID,
  errorOptions?: { cause?: unknown }
): Promise<ZeApplicationConfig> {
  try {
    return await refreshApplicationConfiguration(authContext, {
      edgeUrl: targetEdgeUrl,
    });
  } catch (cause) {
    throw new ZephyrError(errorType, {
      ...errorOptions,
      cause,
    });
  }
}
