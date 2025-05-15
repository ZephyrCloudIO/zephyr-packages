import { clear, getItem, removeItem, setItem } from 'node-persist';
import { getSecretToken } from './secret-token';
import { storage } from './storage';
import { StorageKeys } from './storage-keys';

export async function saveToken(token: string): Promise<void> {
  await storage;
  await setItem(StorageKeys.ze_auth_token, token);
}

export async function getToken(): Promise<string | undefined> {
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
