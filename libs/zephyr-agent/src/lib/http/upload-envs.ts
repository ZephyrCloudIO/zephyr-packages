import type { ZeUploadBuildStats } from 'zephyr-edge-contract';
import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import { ZeErrors, ZephyrError } from '../errors';
import { ze_log } from '../logging';
import type { LogEvent } from '../logging/ze-log-event';
import { makeRequest } from './http-request';

export async function uploadEnvs({
  body,
  application_uid,
  logEvent,
}: {
  body: ZeUploadBuildStats;
  application_uid: string;
  logEvent: LogEvent;
}): Promise<void> {
  ze_log.upload(`Uploading envs to Zephyr, for ${application_uid}`);

  const { EDGE_URL, jwt } = await getApplicationConfiguration({
    application_uid,
  });

  const json = JSON.stringify(body);

  const options: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Length': Buffer.byteLength(json).toString(),
      'Content-Type': 'application/json; charset=utf-8',
      can_write_jwt: jwt,
    },
  };

  const url = new URL('/upload', EDGE_URL);
  url.searchParams.append('type', 'envs');

  const [ok, cause, data] = await makeRequest<unknown>(
    url,
    options,
    JSON.stringify(body)
  );

  if (!ok || !data) {
    logEvent({
      level: 'error',
      action: 'deploy:edge:failed',
      message: 'failed deploying local build to edge',
    });

    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, { type: 'envs', cause: cause });
  }
}
