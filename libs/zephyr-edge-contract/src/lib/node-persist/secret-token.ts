import { StorageKeys } from './storage-keys';

export async function getSecretToken(): Promise<string | undefined> {
  return process.env[StorageKeys.ze_secret_token];
}

