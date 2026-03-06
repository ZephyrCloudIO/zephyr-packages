import { getItem, removeItem, setItem } from 'node-persist';
import { StorageKeys } from './storage-keys';
import type { ZeApplicationConfig } from './upload-provider-options';
import { storage } from './storage';

function get_key(application_uid: string): string {
  return [StorageKeys.ze_app_config_token, application_uid].join('.');
}

export async function saveAppConfig(
  application_uid: string,
  json: ZeApplicationConfig
): Promise<void> {
  await storage;
  void (await setItem(get_key(application_uid), json, { ttl: 5 * 60 * 1000 }));
}

export async function getAppConfig(
  application_uid: string
): Promise<ZeApplicationConfig | undefined> {
  await storage;
  return getItem(get_key(application_uid));
}

export async function removeAppConfig(application_uid: string): Promise<void> {
  await storage;
  await removeItem(get_key(application_uid));
}
