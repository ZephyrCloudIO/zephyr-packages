import { ZE_API_ENDPOINT, ze_api_gateway } from 'zephyr-edge-contract';
import {
  ATTR_URL_FULL,
  ATTR_ZEPHYR_APPLICATION_UID,
  ATTR_ZEPHYR_APPLICATION_VERSION,
  SpanKind,
} from '@zephyrcloud/telemetry';
import { ZeErrors, ZephyrError } from '../lib/errors';
import { makeRequest, parseUrl } from '../lib/http/http-request';
import { ze_log } from '../lib/logging';
import { getToken } from '../lib/node-persist/token';
import { withTelemetrySpan } from '../lib/telemetry';
export interface ZeResolvedDependency {
  name: string;
  version: string;

  application_uid: string;
  default_url: string;
  remote_entry_url: string;
  library_type: string;
  platform?: string;
}

export async function resolve_remote_dependency({
  application_uid,
  version,
  platform,
  build_context,
}: {
  application_uid: string;
  version: string;
  platform?: string;
  build_context: string;
}): Promise<ZeResolvedDependency> {
  return withTelemetrySpan(
    'zephyr.remote_dependency.resolve',
    async () => {
      const depUrl =
        ZE_API_ENDPOINT() +
        `${ze_api_gateway.resolve}/` +
        `${encodeURIComponent(application_uid)}/` +
        `${encodeURIComponent(version)}`;
      const resolveDependency = parseUrl(depUrl);

      if (platform) {
        resolveDependency.searchParams.append('build_target', platform);
      }

      if (build_context) {
        resolveDependency.searchParams.append('build_context', build_context);
      }

      try {
        ze_log.remotes('URL for resolving dependency:', resolveDependency.toString());

        const token = await getToken();
        const [ok, cause, response] = await makeRequest<{ value: ZeResolvedDependency }>(
          resolveDependency,
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          }
        );

        // used only for error logging
        const [appName, projectName, orgName] = application_uid.split('.');

        if (!ok) {
          throw new ZephyrError(ZeErrors.ERR_RESOLVE_REMOTES, {
            appUid: application_uid,
            appName,
            projectName,
            orgName,
            version,
            data: {
              url: resolveDependency.toString(),
              error: cause?.message,
            },
          });
        }

        if (response.value) {
          ze_log.remotes(
            'resolved dependency:',
            response.value,
            'application_uid: ',
            application_uid,
            'version: ',
            version
          );
          return Object.assign({}, response.value, { version, platform });
        }

        throw new ZephyrError(ZeErrors.ERR_RESOLVE_REMOTES, {
          appUid: application_uid,
          appName,
          projectName,
          orgName,
          version,
          data: { response },
        });
      } catch (cause) {
        if (cause instanceof ZephyrError) throw cause;

        throw new ZephyrError(ZeErrors.ERR_CANNOT_RESOLVE_APP_NAME_WITH_VERSION, {
          version,
          cause,
        });
      }
    },
    {
      [ATTR_ZEPHYR_APPLICATION_UID]: application_uid,
      [ATTR_ZEPHYR_APPLICATION_VERSION]: version,
      [ATTR_URL_FULL]: `${ZE_API_ENDPOINT()}${ze_api_gateway.resolve}`,
    },
    SpanKind.CLIENT
  );
}
