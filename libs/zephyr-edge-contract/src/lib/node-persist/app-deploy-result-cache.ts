import { getItem, init, removeItem, setItem } from 'node-persist';
import { join } from 'node:path';
import { homedir } from 'node:os';

import { StorageKeys, ZE_PATH } from './storage-keys';

const storage = init({
  dir: join(homedir(), ZE_PATH),
});

export async function setAppDeployResult(
  application_uid: string,
  value: { urls: string[] }
): Promise<void> {
  await storage;
  void (await setItem(
    `${StorageKeys.ze_app_deploy_result}:${application_uid}`,
    value,
    { ttl: 1000 * 60 * 60 * 24 }
  ));
}

export async function getAppDeployResult(
  application_uid: string
): Promise<{ urls: string[] } | undefined> {
  await storage;
  return getItem(`${StorageKeys.ze_app_deploy_result}:${application_uid}`);
}

export async function removeAppDeployResult(
  application_uid: string
): Promise<void> {
  await storage;
  await removeItem(`${StorageKeys.ze_app_deploy_result}:${application_uid}`);
}
