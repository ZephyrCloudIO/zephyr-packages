import { ZE_API_ENDPOINT, ze_api_gateway } from 'zephyr-edge-contract';
import { isTokenStillValid } from '../auth/login';
import { ZeApplicationConfig } from '../node-persist/upload-provider-options';
import { ZeErrors, ZephyrError } from '../errors';
import { getToken } from '../node-persist/token';
import { ZeHttpRequest } from '../http/ze-http-request';
import { ze_log } from '../logging';
import { getAppConfig, saveAppConfig } from '../node-persist/application-configuration';

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

  const [ok, cause, data] = await ZeHttpRequest.from<{
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
  ze_log('Getting application configuration from node-persist');
  const promise = addToQueue();
  if (callsQueue.length === 1) {
    const storedAppConfig = await getAppConfig(application_uid);
    if (
      !storedAppConfig ||
      (storedAppConfig &&
        (!isTokenStillValid(storedAppConfig.jwt) ||
          !storedAppConfig?.fetched_at ||
          Date.now() - storedAppConfig.fetched_at > 60 * 1000))
    ) {
      ze_log('Loading Application Configuration from API...');
      await loadApplicationConfiguration({ application_uid })
        .then(async (loadedAppConfig) => {
          ze_log('Saving Application Configuration to node-persist...');
          await saveAppConfig(application_uid, loadedAppConfig);

          return loadedAppConfig;
        })
        .then((result) => handleQueue(result))
        .catch((error) => handleQueue(undefined, error));
    } else {
      handleQueue(storedAppConfig);
    }
  }

  return promise;
}

const callsQueue: ((value?: ZeApplicationConfig, error?: Error) => void)[] = [];

function addToQueue(): Promise<ZeApplicationConfig> {
  let resolve!: (value: ZeApplicationConfig) => void;
  let reject!: (error?: Error) => void;
  const callback = (value?: ZeApplicationConfig, error?: Error) => {
    if (value) {
      resolve(value);
    }

    reject(error);
  };
  callsQueue.push(callback);

  return new Promise<ZeApplicationConfig>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  });
}

function handleQueue(result?: ZeApplicationConfig, error?: Error) {
  do {
    const callback = callsQueue.shift();
    if (callback) {
      callback(result, error);
    }
  } while (callsQueue.length);
}
