import { getItem, init, setItem, removeItem } from 'node-persist';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { StorageKeys, ZE_PATH } from './storage-keys';

export interface ZeApplicationConfig {
  user_uuid: string;
  username: string;
  email: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_DOMAIN: string;
  BUILD_ID_ENDPOINT: string;
  EDGE_URL: string;
  jwt: string;
}

const storage = init({
  dir: join(homedir(), ZE_PATH),
});

export async function saveAppConfig(json: ZeApplicationConfig): Promise<void> {
  await storage;
  void (await setItem(StorageKeys.ze_app_config_token, json));
}

export async function getAppConfig(): Promise<ZeApplicationConfig | undefined> {
  await storage;
  return getItem(StorageKeys.ze_app_config_token);
}

export async function remoteAppConfig(): Promise<void> {
  await storage;
  await removeItem(StorageKeys.ze_app_config_token);
}
