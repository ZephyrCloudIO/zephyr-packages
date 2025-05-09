import { getItem, removeItem, setItem } from 'node-persist';
import { storage } from './storage';
import { StorageKeys } from './storage-keys';

export async function saveCache(key: string, value: string): Promise<void> {
  await storage;
  await setItem(`${StorageKeys.ze_fs_cache}:${key}`, value);
}

export async function getCache(key: string): Promise<string | undefined> {
  await storage;
  return getItem(`${StorageKeys.ze_fs_cache}:${key}`);
}

export async function removeCache(key: string): Promise<void> {
  await storage;
  await removeItem(`${StorageKeys.ze_fs_cache}:${key}`);
}
