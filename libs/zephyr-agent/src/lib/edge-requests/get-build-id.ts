// IMPORTANT: The OpenTelemetry SDK must be initialized at the entrypoint by importing the telemetry module before any spans are created.
import { SpanStatusCode } from '@opentelemetry/api';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import { getToken } from '../node-persist/token';
import { getTracer } from '../telemetry';
import { getApplicationConfiguration } from './get-application-configuration';

/**
 * Retrieves a build ID for the given application This function is instrumented with
 * OpenTelemetry tracing for observability
 */
export async function getBuildId(application_uid: string): Promise<string> {
  // Create a tracer specifically for build ID generation operations
  const tracer = getTracer('zephyr.build_id_generation');

  // Start a span to track the entire build ID generation process
  const span = tracer.startSpan('zephyr.build_id_generation', {
    attributes: {
      'zephyr.application_uid': application_uid,
      'zephyr.operation': 'build_id_request',
    },
  });

  try {
    // Get application configuration including endpoints and user info
    const { BUILD_ID_ENDPOINT, user_uuid, jwt, username } =
      await getApplicationConfiguration({ application_uid });

    // Add user information to the span for better observability
    span.setAttributes({
      'zephyr.username': username,
      'zephyr.user_uuid': user_uuid,
    });

    // Prepare authentication headers for the request
    const token = await getToken();
    const options = {
      headers: {
        can_write_jwt: jwt,
        Authorization: 'Bearer ' + token,
      },
    };

    // Make the actual request to get the build ID
    const [ok, cause, data] = await makeRequest<Record<string, string>>(
      BUILD_ID_ENDPOINT,
      options
    );

    // Handle error cases
    if (!ok || !data[user_uuid]) {
      let status: number | undefined = undefined;
      let errorMessage: string | undefined = undefined;
      if (cause && typeof cause === 'object') {
        status = (cause as any).status;
        errorMessage = (cause as any).message;
      }

      // Mark the span as failed and add error details for debugging
      span.setStatus({ code: SpanStatusCode.ERROR });
      span.setAttributes({
        'zephyr.error_code': ZeErrors.ERR_GET_BUILD_ID.id,
        'zephyr.http_status': status,
        'zephyr.error_message': errorMessage,
        'zephyr.permission_denied': status === 403,
      });
      // Record the exception for better error tracking
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

    // Mark the span as successful
    span.setStatus({ code: SpanStatusCode.OK });

    span.end();

    ze_log.app('Build ID retrieved...', data);
    return data[user_uuid];
  } catch (error) {
    // Handle any unexpected errors and mark span as failed
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.recordException(error as Error);

    span.end();

    throw error;
  }
}
