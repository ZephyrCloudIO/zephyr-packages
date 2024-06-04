import { getItem, init, removeItem, setItem } from 'node-persist';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { StorageKeys, ZE_PATH } from './storage-keys';

const storage = init({
  dir: join(homedir(), ZE_PATH),
});

export async function saveCache(key: string, value: string): Promise<void> {
  await storage;
  void (await setItem(`${StorageKeys.ze_fs_cache}:${key}`, value));
}

export async function getCache(key: string): Promise<string | undefined> {
  await storage;
  return getItem(`${StorageKeys.ze_fs_cache}:${key}`);
}

export async function removeCache(key: string): Promise<void> {
  await storage;
  await removeItem(`${StorageKeys.ze_fs_cache}:${key}`);
}
