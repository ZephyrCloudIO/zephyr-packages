import * as jose from 'jose';
import { cleanTokens, getToken } from '../node-persist/token';
import {
  v2_api_paths,
  ZEPHYR_API_ENDPOINT,
} from '../api-contract-negotiation/get-api-contract';
import {
  getAppConfig,
  saveAppConfig,
  ZeApplicationConfig,
} from '../node-persist/application-configuration';
import { isTokenStillValid } from './login';

interface GetApplicationConfigurationProps {
  application_uid: string | undefined;
}

async function loadApplicationConfiguration({
  application_uid,
}: GetApplicationConfigurationProps): Promise<ZeApplicationConfig> {
  if (!application_uid) {
    throw new Error(`[zephyr] Critical error: application_uid is missing`);
  }
  const token = await getToken();
  const application_config_url = new URL(
    v2_api_paths.application_configuration,
    ZEPHYR_API_ENDPOINT
  );
  application_config_url.searchParams.append(
    'application-uid',
    application_uid
  );

  const req = fetch(application_config_url, {
    headers: { Authorization: 'Bearer ' + token },
  });
  req.catch((v) => console.error(v));
  const response = await req;
  if (!response.ok && response.status !== 200) {
    await cleanTokens();
    const err = new Error('[zephyr]: auth error, please try to build again');
    err.stack = void 0;
    throw err;
  }

  const result = await response.json();
  return Object.assign({}, result.value, {
    jwt_decode: jose.decodeJwt(result.value.jwt),
  });
}

export async function getApplicationConfiguration({
  application_uid,
}: GetApplicationConfigurationProps): Promise<ZeApplicationConfig> {
  const storedAppConfig = await getAppConfig();
  if (storedAppConfig && isTokenStillValid(storedAppConfig.jwt)) {
    return storedAppConfig;
  }

  const loadedAppConfig = await loadApplicationConfiguration({
    application_uid,
  });
  await saveAppConfig(loadedAppConfig);
  return loadedAppConfig;
}
