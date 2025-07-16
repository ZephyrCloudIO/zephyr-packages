// IMPORTANT: The OpenTelemetry SDK must be initialized at the entrypoint by importing the telemetry module before any spans are created.
import { SpanStatusCode } from '@opentelemetry/api';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import { getToken } from '../node-persist/token';
import { getTracer } from '../telemetry';
import { getApplicationConfiguration } from './get-application-configuration';

export async function getBuildId(application_uid: string): Promise<string> {
  console.log(
    '[Build ID Debug] 🔧 Starting getBuildId process for application:',
    application_uid
  );

  const tracer = getTracer('zephyr.build_id_generation');
  console.log('[Build ID Debug] 📊 Tracer created, starting span...');

  const span = tracer.startSpan('zephyr.build_id_generation', {
    attributes: {
      'zephyr.application_uid': application_uid,
      'zephyr.operation': 'build_id_request',
    },
  });

  console.log('[Build ID Debug] ✅ Span started successfully');
  console.log(
    '[Build ID Debug] 📤 This span will be sent to Grafana Cloud when completed'
  );

  try {
    console.log('[Build ID Debug] 🔍 Getting application configuration...');
    const { BUILD_ID_ENDPOINT, user_uuid, jwt, username } =
      await getApplicationConfiguration({ application_uid });

    console.log('[Build ID Debug] ✅ Application configuration retrieved');
    console.log('[Build ID Debug] 📝 Adding user context to span...');
    span.setAttributes({
      'zephyr.username': username,
      'zephyr.user_uuid': user_uuid,
    });

    console.log('[Build ID Debug] 🔑 Getting authentication token...');
    const token = await getToken();
    const options = {
      headers: {
        can_write_jwt: jwt,
        Authorization: 'Bearer ' + token,
      },
    };

    console.log('[Build ID Debug] 🌐 Making HTTP request to BUILD_ID_ENDPOINT...');
    console.log('[Build ID Debug] 📍 Endpoint:', BUILD_ID_ENDPOINT);

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

      console.log('[Build ID Debug] ❌ Build ID request failed');
      console.log(
        '[Build ID Debug] 📊 Setting span status to ERROR and adding error attributes'
      );

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

      console.log('[Build ID Debug] 🔚 Ending span with error status');
      span.end();
      console.log('[Build ID Debug] 📤 Error span should now be sent to Grafana Cloud');

      throw new ZephyrError(ZeErrors.ERR_GET_BUILD_ID, {
        application_uid,
        username,
        cause,
        data,
      });
    }

    console.log('[Build ID Debug] ✅ Build ID request successful!');
    console.log('[Build ID Debug] 📊 Setting span status to OK');
    span.setStatus({ code: SpanStatusCode.OK });

    console.log('[Build ID Debug] 🔚 Ending span with success status');
    span.end();
    console.log('[Build ID Debug] 📤 Success span should now be sent to Grafana Cloud');

    ze_log.app('Build ID retrieved...', data);
    return data[user_uuid];
  } catch (error) {
    console.log('[Build ID Debug] 💥 Unexpected error in getBuildId:');
    console.log('[Build ID Debug] Error details:', error);

    console.log('[Build ID Debug] 📊 Setting span status to ERROR for unexpected error');
    span.setStatus({ code: SpanStatusCode.ERROR });
    span.recordException(error as Error);

    console.log('[Build ID Debug] 🔚 Ending span with error status');
    span.end();
    console.log('[Build ID Debug] 📤 Error span should now be sent to Grafana Cloud');

    throw error;
  }
}
