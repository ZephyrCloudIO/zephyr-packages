import { getItem, removeItem, setItem } from 'node-persist';
import { storage } from './storage';
import { StorageKeys } from './storage-keys';
import type { ZeApplicationConfig } from './upload-provider-options';

function get_key(application_uid: string): string {
  return [StorageKeys.ze_app_config_token, application_uid].join('.');
}

export async function saveAppConfig(
  application_uid: string,
  json: ZeApplicationConfig
): Promise<void> {
  await storage;
  await setItem(get_key(application_uid), json, { ttl: 5 * 60 * 1000 });
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

function get_multi_key(application_uid: string): string {
  return [StorageKeys.ze_app_config_token, application_uid, 'multi'].join('.');
}

export async function saveAppConfigs(
  application_uid: string,
  configs: ZeApplicationConfig[]
): Promise<void> {
  await storage;
  void (await setItem(get_multi_key(application_uid), configs, { ttl: 5 * 60 * 1000 }));
}

export async function getAppConfigs(
  application_uid: string
): Promise<ZeApplicationConfig[] | undefined> {
  await storage;
  return getItem(get_multi_key(application_uid));
}

export async function removeAppConfigs(application_uid: string): Promise<void> {
  await storage;
  await removeItem(get_multi_key(application_uid));
}
