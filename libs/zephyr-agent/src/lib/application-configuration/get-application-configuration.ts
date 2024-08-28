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

let refetching_app_config = false;

export async function getApplicationConfiguration({ application_uid }: GetApplicationConfigurationProps): Promise<ZeApplicationConfig> {
  ze_log('Getting application configuration from node-persist');

  const storedAppConfig = await getAppConfig(application_uid);

  if (storedAppConfig && isTokenStillValid(storedAppConfig.jwt)) {
    if (!refetching_app_config && (!storedAppConfig?.fetched_at || Date.now() - storedAppConfig.fetched_at > 60 * 1000)) {
      refetching_app_config = true;
      loadApplicationConfiguration({ application_uid }).then((reloadedAppConfig) => {
        refetching_app_config = false;
        if (!reloadedAppConfig) return;
        saveAppConfig(application_uid, reloadedAppConfig);
      });
    }
    return storedAppConfig;
  }

  ze_log('Loading Application Configuration from API...');
  const loadedAppConfig = await loadApplicationConfiguration({
    application_uid,
  });
  ze_log('Saving Application Configuration to node-persist...');
  if (!loadedAppConfig) throw new ConfigurationError(`ZE20014`, `Failed to load application configuration...`, `critical`);

  await saveAppConfig(application_uid, loadedAppConfig);

  return loadedAppConfig;
}
