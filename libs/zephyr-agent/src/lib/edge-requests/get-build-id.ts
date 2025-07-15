import { SpanStatusCode } from '@opentelemetry/api';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import { getToken } from '../node-persist/token';
import { getTracer } from '../telemetry'; // Only import getTracer now
import { getApplicationConfiguration } from './get-application-configuration';

console.log('[telemetry] get-build-id.ts loaded');

export async function getBuildId(application_uid: string): Promise<string> {
  // Initialize a tracer specifically for build ID generation
  const tracer = getTracer('zephyr.build_id_generation');
  // Start a new span for Build ID generation
  console.log('[telemetry] Starting span: zephyr.build_id_generation');
  const span = tracer.startSpan('zephyr.build_id_generation', {
    attributes: {
      'zephyr.application_uid': application_uid,
      'zephyr.operation': 'build_id_request',
    },
  });

  try {
    // Get application configuration (calls API/cache)
    const { BUILD_ID_ENDPOINT, user_uuid, jwt, username } =
      await getApplicationConfiguration({
        application_uid,
      });

    // Add more context to the span
    console.log('[telemetry] Setting span attributes: username, user_uuid');
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

    // Make the request to get the build ID
    const [ok, cause, data] = await makeRequest<Record<string, string>>(
      BUILD_ID_ENDPOINT,
      options
    );

    // If the request failed or the build ID is missing, record error details in the span
    if (!ok || !data[user_uuid]) {
      // Print the 'cause' object to inspect its structure
      console.log('[telemetry] Build ID generation failed, cause:', cause);
      // Type guard for cause
      let status: number | undefined = undefined;
      let errorMessage: string | undefined = undefined;
      if (cause && typeof cause === 'object') {
        status = (cause as any).status;
        errorMessage = (cause as any).message;
      }
      span.setStatus({ code: SpanStatusCode.ERROR });
      console.log('[telemetry] Setting error attributes on span');
      span.setAttributes({
        'zephyr.error_code': ZeErrors.ERR_GET_BUILD_ID.id,
        'zephyr.http_status': status,
        'zephyr.error_message': errorMessage,
        'zephyr.permission_denied': status === 403,
      });
      // Record the exception in the span (only allowed properties)
      span.recordException({
        message: 'Failed to get build ID',
        name: 'BuildIdError',
      });
      console.log('[telemetry] Ending span (error path)');
      span.end();
      throw new ZephyrError(ZeErrors.ERR_GET_BUILD_ID, {
        application_uid,
        username,
        cause,
        data,
      });
    }

    // Mark the span as successful
    span.setStatus({ code: SpanStatusCode.OK });
    console.log('[telemetry] Build ID retrieved, ending span (success path)');
    span.end();
    ze_log.app('Build ID retrieved...', data);
    return data[user_uuid];
  } catch (error) {
    // Record any unexpected exceptions
    console.log('[telemetry] Caught exception, recording and ending span');
    span.recordException(error as any);
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.end();
    throw error;
  }
}
