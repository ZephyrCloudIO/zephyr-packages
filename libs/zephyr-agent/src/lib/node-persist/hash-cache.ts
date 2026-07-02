import node_persist from 'node-persist';
import { storage } from './storage';
import { StorageKeys } from './storage-keys';

export async function setAppHashCache(
  application_uid: string,
  value: { hashes: string[] }
): Promise<void> {
  await storage;
  await node_persist.setItem(`${StorageKeys.ze_hash_cache}:${application_uid}`, value, {
    ttl: 1000 * 60 * 60 * 24,
  });
}

export async function getAppHashCache(
  application_uid: string
): Promise<{ hashes: string[] } | undefined> {
  await storage;
  return node_persist.getItem(`${StorageKeys.ze_hash_cache}:${application_uid}`);
}

export async function removeAppHashCache(application_uid: string): Promise<void> {
  await storage;
  await node_persist.removeItem(`${StorageKeys.ze_hash_cache}:${application_uid}`);
}
