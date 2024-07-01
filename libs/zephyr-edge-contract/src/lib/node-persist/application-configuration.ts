import { getItem, init, setItem, removeItem } from 'node-persist';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { StorageKeys, ZE_PATH } from './storage-keys';

export interface NetlifyIntegrationConfig {
  api_token: string;
  site_id: string;
}

export interface ZeApplicationConfig {
  user_uuid: string;
  username: string;
  email: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_DOMAIN: string;
  BUILD_ID_ENDPOINT: string;
  EDGE_URL: string;
  DOMAIN?: string;
  INTEGRATION_CONFIG?: NetlifyIntegrationConfig & { type?: 'worker' | 'pages' };
  PLATFORM: 'cloudflare' | 'netlify';
  jwt: string;
}

const storage = init({
  dir: join(homedir(), ZE_PATH),
});

function get_key(application_uid: string): string {
  return [StorageKeys.ze_app_config_token, application_uid].join('.');
}

export async function saveAppConfig(
  application_uid: string,
  json: ZeApplicationConfig
): Promise<void> {
  await storage;
  void (await setItem(get_key(application_uid), json));
}

export async function getAppConfig(
  application_uid: string
): Promise<ZeApplicationConfig | undefined> {
  await storage;
  return getItem(get_key(application_uid));
}

export async function remoteAppConfig(application_uid: string): Promise<void> {
  await storage;
  await removeItem(get_key(application_uid));
}
