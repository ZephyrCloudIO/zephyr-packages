// IMPORTANT: The OpenTelemetry SDK must be initialized at the entrypoint by importing the telemetry module before any spans are created.
import { SpanStatusCode } from '@opentelemetry/api';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import { getToken } from '../node-persist/token';
import { getTracer } from '../telemetry';
import { getApplicationConfiguration } from './get-application-configuration';

export async function getBuildId(application_uid: string): Promise<string> {
  const tracer = getTracer('zephyr.build_id_generation');

  const span = tracer.startSpan('zephyr.build_id_generation', {
    attributes: {
      'zephyr.application_uid': application_uid,
      'zephyr.operation': 'build_id_request',
    },
  });

  try {
    const { BUILD_ID_ENDPOINT, user_uuid, jwt, username } =
      await getApplicationConfiguration({ application_uid });

    span.setAttributes({
      'zephyr.username': username,
      'zephyr.user_uuid': user_uuid,
    });

    const token = await getToken();
    const options = {
      headers: {
        can_write_jwt: jwt,
        Authorization: 'Bearer ' + token,
      },
    };

    const [ok, cause, data] = await makeRequest<Record<string, string>>(
      BUILD_ID_ENDPOINT,
      options
    );

    if (!ok || !data[user_uuid]) {
      let status: number | undefined = undefined;
      let errorMessage: string | undefined = undefined;
      if (cause && typeof cause === 'object') {
        status = (cause as any).status;
        errorMessage = (cause as any).message;
      }

      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttributes({
        'zephyr.error_code': ZeErrors.ERR_GET_BUILD_ID.id,
        'zephyr.http_status': status,
        'zephyr.error_message': errorMessage,
        'zephyr.permission_denied': status === 403,
      });
      span.recordException({
        message: 'Failed to get build ID',
        name: 'BuildIdError',
      });

      span.end();

      throw new ZephyrError(ZeErrors.ERR_GET_BUILD_ID, {
        application_uid,
        username,
        cause,
        data,
      });
    }

    span.setStatus({ code: SpanStatusCode.OK });

    span.end();

    ze_log.app('Build ID retrieved...', data);
    return data[user_uuid];
  } catch (error) {
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.recordException(error as Error);

    span.end();

    throw error;
  }
}
