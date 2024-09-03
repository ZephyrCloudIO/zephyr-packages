import {
  ZE_API_ENDPOINT,
  type ZeApplicationConfig,
  getAppConfig,
  getToken,
  request,
  saveAppConfig,
  ze_api_gateway,
  ze_error,
  ze_log,
} from 'zephyr-edge-contract';
import { isTokenStillValid } from '../auth/login';
import { ConfigurationError } from '../custom-errors/configuration-error';

interface GetApplicationConfigurationProps {
  application_uid: string;
}

async function loadApplicationConfiguration({
  application_uid,
}: GetApplicationConfigurationProps): Promise<ZeApplicationConfig | undefined> {
  if (!application_uid) {
    throw new ConfigurationError('ZE10017', 'application_uid is missing...\n', 'critical');
  }

  const token = await getToken();
  const application_config_url = new URL(`${ze_api_gateway.application_config}/${application_uid}`, ZE_API_ENDPOINT());

  try {
    const response = await request<{ value: ZeApplicationConfig }>(application_config_url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (typeof response !== 'string') {
      ze_log('Application Configuration loaded...', response);

      return {
        ...response.value,
        fetched_at: Date.now(),
      };
    }

    ze_error('ERR_LOAD_APP_CONFIG', 'Invalid application configuration.', response);
    return;
  } catch (v) {
    ze_error('ERR_LOAD_APP_CONFIG', 'Failed to load application configuration', v);
    return;
  }
}

/**
 * Gather all calls until the first returns result:
 * - no parallel requests to api
 * - almost all actual data
 *
 * Note: not the best solution, but works until we use the same application_uid during execution
 */
export async function getApplicationConfiguration({ application_uid }: GetApplicationConfigurationProps): Promise<ZeApplicationConfig> {
  ze_log('Getting application configuration from node-persist');
  const promise = addToQueue();
  if (callsQueue.length === 1) {
    const storedAppConfig = await getAppConfig(application_uid);
    if (
      !storedAppConfig ||
      (storedAppConfig &&
        (!isTokenStillValid(storedAppConfig.jwt) || !storedAppConfig?.fetched_at || Date.now() - storedAppConfig.fetched_at > 60 * 1000))
    ) {
      ze_log('Loading Application Configuration from API...');
      await loadApplicationConfiguration({ application_uid })
        .then(async (loadedAppConfig) => {
          if (!loadedAppConfig) {
            throw new ConfigurationError(`ZE20014`, `Failed to load application configuration...`, `critical`);
          }

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
