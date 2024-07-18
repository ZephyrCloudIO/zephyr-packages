import * as jose from 'jose';
import {
  getAppConfig,
  getToken,
  request,
  saveAppConfig,
  v2_api_paths,
  ze_error,
  ze_log,
  ZeApplicationConfig,
  ZEPHYR_API_ENDPOINT,
} from 'zephyr-edge-contract';
import { isTokenStillValid } from '../auth/login';
import { ConfigurationError } from '../custom-errors/configuration-error';

interface GetApplicationConfigurationProps {
  application_uid: string;
}

async function loadApplicationConfiguration({
  application_uid,
}: GetApplicationConfigurationProps): Promise<ZeApplicationConfig | void> {
  if (!application_uid) {
    throw new ConfigurationError(
      `BU10017`,
      `application_uid is missing...\n`,
      `critical`
    );
  }
  const token = await getToken();
  const application_config_url = new URL(
    v2_api_paths.application_configuration,
    ZEPHYR_API_ENDPOINT()
  );
  application_config_url.searchParams.append(
    'application-uid',
    application_uid
  );

  const response = await request<{ value: ZeApplicationConfig }>(
    application_config_url,
    {
      headers: { Authorization: 'Bearer ' + token },
    }
  ).catch((v) =>
    ze_error('DE20014', 'Failed to load application configuration', v)
  );

  if (!response || typeof response === 'string')
    return ze_error(
      'DE20014',
      'Failed to load application configuration.',
      response
    );

  ze_log('Application Configuration loaded...', response);
  return Object.assign({}, response.value, {
    fetched_at: Date.now(),
    jwt_decode: jose.decodeJwt(response.value.jwt), // Is it necessary? It seems this property unused.
  });
}

let refetching_app_config = false;

export async function getApplicationConfiguration({
  application_uid,
}: GetApplicationConfigurationProps): Promise<ZeApplicationConfig> {
  ze_log('Getting application configuration from node-persist');
  const storedAppConfig = await getAppConfig(application_uid);
  if (storedAppConfig && isTokenStillValid(storedAppConfig.jwt)) {
    if (
      !refetching_app_config &&
      (!storedAppConfig?.fetched_at ||
        Date.now() - storedAppConfig.fetched_at > 60 * 1000)
    ) {
      refetching_app_config = true;
      loadApplicationConfiguration({ application_uid }).then(
        (reloadedAppConfig) => {
          refetching_app_config = false;
          if (!reloadedAppConfig) return;
          saveAppConfig(application_uid, reloadedAppConfig);
        }
      );
    }
    return storedAppConfig;
  }

  ze_log('Loading Application Configuration from API...');
  const loadedAppConfig = await loadApplicationConfiguration({
    application_uid,
  });
  ze_log('Saving Application Configuration to node-persist...');
  if (!loadedAppConfig)
    throw new ConfigurationError(
      `DE20014`,
      `Failed to load application configuration...`,
      `critical`
    );

  await saveAppConfig(application_uid, loadedAppConfig);
  return loadedAppConfig;
}
