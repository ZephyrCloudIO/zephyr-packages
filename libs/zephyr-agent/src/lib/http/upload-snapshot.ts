import type { Snapshot, SnapshotUploadRes } from 'zephyr-edge-contract';
import { checkAuth, isTokenStillValid } from '../auth/login';
import {
  getApplicationConfiguration,
  invalidateApplicationConfigCache,
} from '../edge-requests/get-application-configuration';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import { makeRequest } from './http-request';

export async function uploadSnapshot({
  body,
  application_uid,
}: {
  body: Snapshot;
  application_uid: string;
}): Promise<SnapshotUploadRes> {
  const { EDGE_URL, jwt } = await getApplicationConfiguration({
    application_uid,
  });

  // Check if JWT is still valid before attempting upload
  if (!isTokenStillValid(jwt)) {
    // Token has expired, trigger re-authentication (this will show the auth popup)
    await checkAuth();
    invalidateApplicationConfigCache();

    throw new ZephyrError(ZeErrors.ERR_JWT_INVALID);
  }

  const json = JSON.stringify(body);
  ze_log.snapshot('Sending snapshot to edge:', JSON.stringify(body, null, 2));

  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Length': Buffer.byteLength(json).toString(),
      'Content-Type': 'application/json; charset=utf-8',
      can_write_jwt: jwt,
    },
  };

  const url = new URL('/upload', EDGE_URL);
  url.searchParams.append('type', 'snapshot');
  url.searchParams.append('skip_assets', 'true');
  ze_log.snapshot('Upload URL:', url.toString());

  const [ok, cause, resp] = await makeRequest<SnapshotUploadRes>(url, options, json);

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
      type: 'snapshot',
      cause,
    });
  }

  ze_log.snapshot('Done: snapshot uploaded...', body);

  return resp;
}
