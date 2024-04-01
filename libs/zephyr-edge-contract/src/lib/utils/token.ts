import { getItem, init, setItem, clear } from 'node-persist';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ZE_PATH = `.zephyr`;

const enum StorageKeys {
  zetoken = 'ze-token',
}

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

export async function clearAll(): Promise<void> {
  await storage;
  return clear();
}
