import { clear, getItem, init, InitOptions, removeItem, setItem } from 'node-persist';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { StorageKeys, ZE_PATH } from './storage-keys';
import { getSecretToken } from './secret-token';

// Make storage initialization lazy and synchronized
let storageInitialized = false;
let storagePromise: Promise<InitOptions> | null = null;

async function getStorage() {
  if (!storageInitialized) {
    if (!storagePromise) {
      storagePromise = init({
        dir: join(homedir(), ZE_PATH),
      });
    }
    await storagePromise;
    storageInitialized = true;
  }
  return storagePromise!;
}

export async function saveToken(token: string): Promise<void> {
  await getStorage();
  await setItem(StorageKeys.ze_auth_token, token);
}

export async function getToken(): Promise<string | undefined> {
  const tokenFromEnv = getSecretToken();

  if (tokenFromEnv) {
    return tokenFromEnv;
  }

  await getStorage();

  return getItem(StorageKeys.ze_auth_token);
}

export async function removeToken(): Promise<void> {
  await getStorage();
  await removeItem(StorageKeys.ze_auth_token);
}

export async function cleanTokens(): Promise<void> {
  await getStorage();
  await clear();
}
