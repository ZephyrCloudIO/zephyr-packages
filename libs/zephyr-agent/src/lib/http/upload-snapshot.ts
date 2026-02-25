import type { Snapshot, SnapshotUploadRes } from 'zephyr-edge-contract';
import { checkAuth, isTokenStillValid } from '../auth/login';
import type { ZeGitInfo } from '../build-context/ze-util-get-git-info';
import {
  getApplicationConfiguration,
  invalidateApplicationConfigCache,
} from '../edge-requests/get-application-configuration';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import type { HttpResponse } from './http-request';
import { makeRequest } from './http-request';

export async function uploadSnapshot({
  body,
  application_uid,
  git_config,
}: {
  body: Snapshot;
  application_uid: string;
  git_config: ZeGitInfo;
}): Promise<SnapshotUploadRes> {
  const appConfig = await getApplicationConfiguration({ application_uid });
  const { EDGE_URL, ENVIRONMENTS } = appConfig;
  let { jwt } = appConfig;

  if (!isTokenStillValid(jwt)) {
    jwt = await refreshAuthAndJwt({ application_uid, git_config });
  }

  const json = JSON.stringify(body);
  ze_log.snapshot('Sending snapshot to edge:', JSON.stringify(body, null, 2));

  const resp = await uploadSnapshotWithRetry({
    json,
    edge_url: EDGE_URL,
    jwt,
    application_uid,
    git_config,
  });

  if (ENVIRONMENTS != null) {
    const env_edge_urls = Array.from(
      new Set(Object.values(ENVIRONMENTS).filter((envCfg) => envCfg.edgeUrl !== EDGE_URL))
    );
    await Promise.all(
      env_edge_urls.map((envConfig: { edgeUrl: string }): Promise<SnapshotUploadRes> => {
        return uploadSnapshotWithRetry({
          json,
          edge_url: envConfig.edgeUrl,
          jwt,
          application_uid,
          git_config,
        });
      })
    );
  }

  ze_log.snapshot('Done: snapshot uploaded...', body);

  return resp;
}

async function doUploadSnapshotRequest({
  json,
  edge_url,
  jwt,
}: {
  json: string;
  edge_url: string;
  jwt: string;
}): Promise<HttpResponse<SnapshotUploadRes>> {
  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Length': Buffer.byteLength(json).toString(),
      'Content-Type': 'application/json; charset=utf-8',
      can_write_jwt: jwt,
    },
  };

  const url = new URL('/upload', edge_url);
  url.searchParams.append('type', 'snapshot');
  url.searchParams.append('skip_assets', 'true');
  ze_log.snapshot('Upload URL:', url.toString());

  return makeRequest<SnapshotUploadRes>(url, options, json);
}

function isAuthError(cause: unknown): boolean {
  return (
    ZephyrError.is(cause, ZeErrors.ERR_AUTH_ERROR) ||
    ZephyrError.is(cause, ZeErrors.ERR_AUTH_FORBIDDEN_ERROR)
  );
}

async function refreshAuthAndJwt({
  application_uid,
  git_config,
}: {
  application_uid: string;
  git_config: ZeGitInfo;
}): Promise<string> {
  try {
    await checkAuth(git_config);
    await invalidateApplicationConfigCache(application_uid);
    const appConfig = await getApplicationConfiguration({ application_uid });
    return appConfig.jwt;
  } catch (cause) {
    throw new ZephyrError(ZeErrors.ERR_JWT_INVALID, { cause });
  }
}

async function uploadSnapshotWithRetry({
  json,
  edge_url,
  jwt,
  application_uid,
  git_config,
}: {
  json: string;
  edge_url: string;
  jwt: string;
  application_uid: string;
  git_config: ZeGitInfo;
}): Promise<SnapshotUploadRes> {
  let [ok, cause, resp] = await doUploadSnapshotRequest({ json, edge_url, jwt });

  if (!ok && isAuthError(cause)) {
    const refreshedJwt = await refreshAuthAndJwt({ application_uid, git_config });
    [ok, cause, resp] = await doUploadSnapshotRequest({
      json,
      edge_url,
      jwt: refreshedJwt,
    });
  }

  if (!ok) {
    if (isAuthError(cause)) {
      throw new ZephyrError(ZeErrors.ERR_JWT_INVALID, { cause });
    }

    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'snapshot',
      cause,
    });
  }

  if (!resp) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'snapshot',
      cause,
    });
  }

  return resp;
}
