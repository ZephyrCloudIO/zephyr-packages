import { clear, getItem, init, removeItem, setItem } from 'node-persist';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { StorageKeys, ZE_PATH } from './storage-keys';
import { getSecretToken } from './secret-token';
import { ze_log } from '../logging';
// Make storage initialization lazy and synchronized
const storage = init({
  dir: join(homedir(), ZE_PATH),
});

export async function saveToken(token: string): Promise<void> {
  await storage;
  await setItem(StorageKeys.ze_auth_token, token);
}

export async function getToken(): Promise<string | undefined> {
  ze_log('getToken: Getting token...');
  const tokenFromEnv = getSecretToken();

  if (tokenFromEnv) {
    return tokenFromEnv;
  }

  await storage;

  return getItem(StorageKeys.ze_auth_token);
}

export async function removeToken(): Promise<void> {
  await storage;
  await removeItem(StorageKeys.ze_auth_token);
}

export async function cleanTokens(): Promise<void> {
  await storage;
  await clear();
}
