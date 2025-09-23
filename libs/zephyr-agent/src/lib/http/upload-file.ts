import { type UploadableAsset } from 'zephyr-edge-contract';
import { checkAuth, isTokenStillValid } from '../auth/login';
import { invalidateApplicationConfigCache } from '../edge-requests/get-application-configuration';
import { ZeErrors, ZephyrError } from '../errors';
import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';
import { makeRequest } from './http-request';

export interface UploadFileProps {
  hash: string;
  asset: UploadableAsset;
}

export async function uploadFile(
  { hash, asset }: UploadFileProps,
  { EDGE_URL, jwt }: ZeApplicationConfig
) {
  // Check if JWT is still valid before attempting upload
  if (!isTokenStillValid(jwt)) {
    // Token has expired, trigger re-authentication (this will show the auth popup)
    await checkAuth();
    invalidateApplicationConfigCache();

    throw new ZephyrError(ZeErrors.ERR_JWT_INVALID);
  }

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
    // Check if the error is auth-related and token has expired since our check
    if (
      cause &&
      ZephyrError.is(cause) &&
      (cause.code === 'ZE10018' || cause.code === 'ZE10022')
    ) {
      // This is an auth error - trigger re-authentication
      await checkAuth();
      invalidateApplicationConfigCache();

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
