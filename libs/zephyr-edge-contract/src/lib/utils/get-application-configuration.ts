import * as jose from 'jose';
import { cleanTokens, getToken } from '../node-persist/token';
import { v2_api_paths, ZEPHYR_API_ENDPOINT } from '../api-contract-negotiation/get-api-contract';
import { getAppConfig, saveAppConfig, ZeApplicationConfig } from '../node-persist/application-configuration';
import { isTokenStillValid } from './login';
import { ze_error, ze_log } from './debug';
import { request } from './ze-http-request';

interface GetApplicationConfigurationProps {
  application_uid: string | undefined;
}

async function loadApplicationConfiguration({
                                              application_uid,
                                            }: GetApplicationConfigurationProps): Promise<ZeApplicationConfig | void> {
  if (!application_uid) {
    throw new Error(`[zephyr] Critical error: application_uid is missing`);
  }
  const token = await getToken();
  const application_config_url = new URL(
    v2_api_paths.application_configuration,
    ZEPHYR_API_ENDPOINT,
  );
  application_config_url.searchParams.append(
    'application-uid',
    application_uid,
  );

  const response = await request<{ value: ZeApplicationConfig }>(application_config_url, {
    headers: { Authorization: 'Bearer ' + token },
  })
    .catch((v) => ze_error('Failed to load application configuration', v));

  if (!response || typeof response === 'string')
    return ze_error('Failed to load application configuration', response);

  ze_log('Application Configuration loaded', response);
  return Object.assign({}, response.value, {
    jwt_decode: jose.decodeJwt(response.value.jwt),
  });
}

export async function getApplicationConfiguration({
                                                    application_uid,
                                                  }: GetApplicationConfigurationProps): Promise<ZeApplicationConfig> {
  // ze_log('Getting application configuration from node-persist');
  const storedAppConfig = await getAppConfig();
  if (storedAppConfig && isTokenStillValid(storedAppConfig.jwt)) {
    return storedAppConfig;
  }

  ze_log('Loading Application Configuration from API');
  const loadedAppConfig = await loadApplicationConfiguration({
    application_uid,
  });
  ze_log('Saving Application Configuration to node-persist');
  if (!loadedAppConfig) throw new Error('Failed to load application configuration');

  await saveAppConfig(loadedAppConfig);
  return loadedAppConfig;
}
