import { persistentStorage, storage } from './storage';
import { StorageKeys } from './storage-keys';

export async function setAppHashCache(
  application_uid: string,
  value: { hashes: string[] }
): Promise<void> {
  await storage;
  await persistentStorage.setItem(
    `${StorageKeys.ze_hash_cache}:${application_uid}`,
    value,
    {
      ttl: 1000 * 60 * 60 * 24,
    }
  );
}

export async function getAppHashCache(
  application_uid: string
): Promise<{ hashes: string[] } | undefined> {
  await storage;
  return persistentStorage.getItem(`${StorageKeys.ze_hash_cache}:${application_uid}`);
}

export async function removeAppHashCache(application_uid: string): Promise<void> {
  await storage;
  await persistentStorage.removeItem(`${StorageKeys.ze_hash_cache}:${application_uid}`);
}
