import { ZE_API_ENDPOINT, ze_api_gateway } from 'zephyr-edge-contract';
import { isTokenStillValid } from '../auth/login';
import { ZeErrors, ZephyrError } from '../errors';
import { makeRequest } from '../http/http-request';
import { ze_log } from '../logging';
import {
  getAppConfig,
  removeAppConfig,
  saveAppConfig,
} from '../node-persist/application-configuration';
import { getToken } from '../node-persist/token';
import type { ZeApplicationConfig } from '../node-persist/upload-provider-options';

interface GetApplicationConfigurationProps {
  application_uid: string;
}

async function loadApplicationConfiguration({
  application_uid,
}: GetApplicationConfigurationProps): Promise<ZeApplicationConfig> {
  if (!application_uid) {
    throw new ZephyrError(ZeErrors.ERR_MISSING_APPLICATION_UID);
  }

  const token = await getToken();
  const application_config_url = new URL(
    `${ze_api_gateway.application_config}/${application_uid}`,
    ZE_API_ENDPOINT()
  );

  const [ok, cause, data] = await makeRequest<{
    value: ZeApplicationConfig;
  }>(application_config_url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!ok || !data?.value) {
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

// --- 1. Module-level cache --------------------------------------------------

/** The single shared promise (null when no request is in flight). */
let inFlight: Promise<ZeApplicationConfig> | null = null;

/** The last successful result (null until we have fetched at least once). */
let cachedConfig: ZeApplicationConfig | null = null;

/**
 * Gather all calls until the first returns result:
 *
 * - No parallel requests to api
 * - Almost all actual data
 *
 * Note: not the best solution, but works until we use the same application_uid during
 * execution
 */
export async function getApplicationConfiguration({
  application_uid,
}: GetApplicationConfigurationProps): Promise<ZeApplicationConfig> {
  // Fast path: we already have a valid cached config
  if (cachedConfig && cachedConfig.application_uid === application_uid) {
    if (
      isTokenStillValid(cachedConfig.jwt) &&
      cachedConfig.fetched_at &&
      Date.now() - cachedConfig.fetched_at <= 60 * 1000
    ) {
      ze_log.app('Using cached application configuration');
      return cachedConfig;
    }
    // If the cached config is invalid, clear it
    cachedConfig = null;
  }

  // Another request already in flight → piggy-back on it
  if (inFlight) return inFlight;

  // We're the first caller → actually start the fetch
  ze_log.app('Getting application configuration from node-persist');

  inFlight = (async () => {
    const storedAppConfig = await getAppConfig(application_uid);

    if (
      !storedAppConfig ||
      (storedAppConfig &&
        (!isTokenStillValid(storedAppConfig.jwt) ||
          !storedAppConfig?.fetched_at ||
          Date.now() - storedAppConfig.fetched_at > 60 * 1000))
    ) {
      ze_log.app('Loading Application Configuration from API...');
      const loadedAppConfig = await loadApplicationConfiguration({ application_uid });
      ze_log.app('Saving Application Configuration to node-persist...');
      await saveAppConfig(application_uid, loadedAppConfig);
      return loadedAppConfig;
    } else {
      return storedAppConfig;
    }
  })()
    .then((config) => {
      cachedConfig = config; // cache the good result
      return config;
    })
    .finally(() => {
      inFlight = null; // allow future refreshes
    });

  return inFlight;
}

/** Invalidate the cached application configuration */
export async function invalidateApplicationConfigCache(application_uid?: string) {
  cachedConfig = null;

  if (application_uid) {
    await removeAppConfig(application_uid);
  }
}
