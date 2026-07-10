import { ze_api_gateway } from 'zephyr-edge-contract';
import { isTokenStillValid } from '../auth/login';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import {
  type ApplicationConfigStorageScope,
  getAppConfig,
  getApplicationConfigStorageScope,
  saveAppConfig,
} from '../node-persist/application-configuration';
import { getToken } from '../node-persist/token';
import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';

interface GetApplicationConfigurationProps {
  application_uid: string;
}

const APPLICATION_CONFIG_TTL_MS = 60 * 1000;

const inFlightByIdentity = new Map<string, Promise<ZeApplicationConfig>>();
const cachedConfigByIdentity = new Map<string, ZeApplicationConfig>();

function getApplicationIdentity(
  scope: ApplicationConfigStorageScope,
  application_uid: string
): string {
  return JSON.stringify([
    scope.apiEndpoint,
    scope.apiGatewayEndpoint,
    scope.environment,
    scope.preview,
    scope.principalFingerprint,
    application_uid,
  ]);
}

function isIdentityForApplication(identity: string, application_uid: string): boolean {
  try {
    const parsed: unknown = JSON.parse(identity);
    return Array.isArray(parsed) && parsed[parsed.length - 1] === application_uid;
  } catch {
    return false;
  }
}

function isValidConfig(
  config: ZeApplicationConfig | null | undefined,
  application_uid: string
): config is ZeApplicationConfig {
  return Boolean(
    config &&
    config.application_uid === application_uid &&
    isTokenStillValid(config.jwt) &&
    config.fetched_at &&
    Date.now() - config.fetched_at <= APPLICATION_CONFIG_TTL_MS
  );
}

async function loadApplicationConfiguration(
  { application_uid }: GetApplicationConfigurationProps,
  scope: ApplicationConfigStorageScope,
  token: string | undefined
): Promise<ZeApplicationConfig> {
  if (!application_uid) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_APPLICATION_UID);
  }

  const application_config_url = new URL(
    `${ze_api_gateway.application_config}/${application_uid}`,
    scope.apiGatewayEndpoint
  );

  const [ok, cause, data] = await makeRequest<{
    value: ZeApplicationConfig;
  }>(application_config_url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!ok || !data?.value || data.value.application_uid !== application_uid) {
    throw new ZephyrError(ZeErrors.ERR_LOAD_APP_CONFIG, {
      application_uid,
      cause,
      data: {
        url: application_config_url.toString(),
      },
    });
  }

  return {
    ...data.value,
    fetched_at: Date.now(),
  };
}

/**
 * Gather concurrent calls for the same application identity until the first returns:
 *
 * - No duplicate parallel requests for the same application
 * - Requests for different applications never share credentials or results
 */
export async function getApplicationConfiguration({
  application_uid,
}: GetApplicationConfigurationProps): Promise<ZeApplicationConfig> {
  if (!application_uid) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_APPLICATION_UID);
  }

  // Token resolution must happen before every fast-cache lookup. The scope stores only
  // its one-way fingerprint, so a rotated principal cannot hit a previous principal's
  // memory cache, single-flight request, or persisted record.
  const token = await getToken();
  const scope = getApplicationConfigStorageScope(token);
  const identity = getApplicationIdentity(scope, application_uid);
  const cachedConfig = cachedConfigByIdentity.get(identity);

  // Fast path: we already have a valid cached config
  if (isValidConfig(cachedConfig, application_uid)) {
    ze_log.app('Using cached application configuration');
    return cachedConfig;
  }
  cachedConfigByIdentity.delete(identity);

  // Another request for this identity is already in flight → piggy-back on it
  const existingRequest = inFlightByIdentity.get(identity);
  if (existingRequest) return existingRequest;

  // We're the first caller → actually start the fetch
  ze_log.app('Getting application configuration from node-persist');

  const request = (async () => {
    const storedAppConfig = await getAppConfig(application_uid, scope);

    if (!isValidConfig(storedAppConfig, application_uid)) {
      ze_log.app('Loading Application Configuration from API...');
      const loadedAppConfig = await loadApplicationConfiguration(
        { application_uid },
        scope,
        token
      );
      ze_log.app('Saving Application Configuration to node-persist...');
      await saveAppConfig(application_uid, loadedAppConfig, scope);
      return loadedAppConfig;
    } else {
      return storedAppConfig;
    }
  })()
    .then((config) => {
      cachedConfigByIdentity.set(identity, config);
      return config;
    })
    .finally(() => {
      if (inFlightByIdentity.get(identity) === request) {
        inFlightByIdentity.delete(identity);
      }
    });

  inFlightByIdentity.set(identity, request);
  return request;
}

/** Invalidate the cached application configuration */
export function invalidateApplicationConfigCache(application_uid?: string): void {
  if (!application_uid) {
    cachedConfigByIdentity.clear();
    return;
  }

  for (const identity of cachedConfigByIdentity.keys()) {
    if (isIdentityForApplication(identity, application_uid)) {
      cachedConfigByIdentity.delete(identity);
    }
  }
}
