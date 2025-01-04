import type { ClientRequestArgs } from 'node:http';
import { getApplicationConfiguration } from '../edge-requests/get-application-configuration';
import { LogEvent } from '../logging/ze-log-event';
import { ZeUploadBuildStats } from 'zephyr-edge-contract';
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

  const options: ClientRequestArgs = {
    method: 'POST',
    headers: {
      'Content-Length': Buffer.byteLength(json),
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
    ze_log('First try uploading envs failed, retry again');

    const [ok2, cause2, data2] = await ZeHttpRequest.from<unknown>(
      {
        path: '/upload',
        base: EDGE_URL,
        query: { type: 'envs' },
      },
      options,
      JSON.stringify(body)
    );

    if (!ok2 || !data2) {
      logEvent({
        level: 'error',
        action: 'deploy:edge:failed',
        message: 'failed deploying local build to edge',
      });

      throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
        type: 'envs',
        cause: { cause, cause2 },
      });
    }
  }
}
