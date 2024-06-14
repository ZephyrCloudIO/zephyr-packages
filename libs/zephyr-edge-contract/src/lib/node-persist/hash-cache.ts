import { getItem, init, removeItem, setItem } from 'node-persist';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { StorageKeys, ZE_PATH } from './storage-keys';

const storage = init({
  dir: join(homedir(), ZE_PATH),
});

export async function setAppHashCache(application_uid: string, value: { hashes: string[] }): Promise<void> {
  await storage;
  void (await setItem(`${StorageKeys.ze_hash_cache}:${application_uid}`, value, { ttl: 1000 * 60 * 60 * 24 }));
}

export async function getAppHashCache(application_uid: string): Promise<{ hashes: string[] } | undefined> {
  await storage;
  return getItem(`${StorageKeys.ze_hash_cache}:${application_uid}`);
}

export async function removeAppHashCache(application_uid: string): Promise<void> {
  await storage;
  await removeItem(`${StorageKeys.ze_hash_cache}:${application_uid}`);
}
