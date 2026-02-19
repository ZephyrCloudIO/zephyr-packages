import { type UploadableAsset } from 'zephyr-edge-contract';
import { checkAuth, isTokenStillValid } from '../auth/login';
import type { ZeGitInfo } from '../build-context/ze-util-get-git-info';
import {
  getApplicationConfiguration,
  invalidateApplicationConfigCache,
} from '../edge-requests/get-application-configuration';
import { ZeErrors, ZephyrError } from '../errors';
import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';
import { makeRequest } from './http-request';

export interface UploadFileProps {
  hash: string;
  asset: UploadableAsset;
}

export interface UploadFileAuthContext {
  application_uid: string;
  git_config: ZeGitInfo;
}

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

  if (!ok && isAuthError(cause)) {
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
    if (isAuthError(cause)) {
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

function isAuthError(cause: unknown): boolean {
  return (
    ZephyrError.is(cause, ZeErrors.ERR_AUTH_ERROR) ||
    ZephyrError.is(cause, ZeErrors.ERR_AUTH_FORBIDDEN_ERROR)
  );
}

async function refreshAuthAndConfig(
  authContext: UploadFileAuthContext,
  targetEdgeUrl: string,
  errorType: typeof ZeErrors.ERR_JWT_INVALID,
  errorOptions?: { cause?: unknown }
): Promise<ZeApplicationConfig> {
  try {
    await checkAuth(authContext.git_config);
    await invalidateApplicationConfigCache(authContext.application_uid);
    const refreshedConfig = await getApplicationConfiguration({
      application_uid: authContext.application_uid,
    });
    return {
      ...refreshedConfig,
      EDGE_URL: targetEdgeUrl,
    };
  } catch (cause) {
    throw new ZephyrError(errorType, {
      ...errorOptions,
      cause,
    });
  }
}
