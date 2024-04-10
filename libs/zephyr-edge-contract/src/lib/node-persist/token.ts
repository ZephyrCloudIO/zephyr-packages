import { getItem, init, setItem, removeItem } from 'node-persist';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { StorageKeys, ZE_PATH } from './storage-keys';

const storage = init({
  dir: join(homedir(), ZE_PATH),
});

export async function saveToken(token: string): Promise<void> {
  await storage;
  void (await setItem(StorageKeys.zetoken, token));
}

export async function getToken(): Promise<string | undefined> {
  await storage;
  return getItem(StorageKeys.zetoken);
}

export async function removeToken(): Promise<void> {
  await storage;
  await removeItem(StorageKeys.zetoken);
}
