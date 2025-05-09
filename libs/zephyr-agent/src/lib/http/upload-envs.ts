import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import type { LogEvent } from '../logging/ze-log-event';
import type { ZeUploadBuildStats } from 'zephyr-edge-contract';
import { ze_log } from '../logging';
import { ZeHttpRequest } from './ze-http-request';
import { ZeErrors, ZephyrError } from '../errors';

export async function uploadEnvs({
  body,
  application_uid,
  logEvent,
}: {
  body: ZeUploadBuildStats;
  application_uid: string;
  logEvent: LogEvent;
}): Promise<void> {
  ze_log(`Uploading envs to Zephyr, for ${application_uid}`);

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

  const [ok, cause, data] = await ZeHttpRequest.from<unknown>(
    {
      path: '/upload',
      base: EDGE_URL,
      query: { type: 'envs' },
    },
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
