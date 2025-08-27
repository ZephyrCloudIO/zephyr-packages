import { StorageKeys } from './storage-keys';

export function getSecretToken(): string | undefined {
  return process.env[StorageKeys.ze_secret_token]?.trim();
}

export function hasSecretToken() {
  return !!getSecretToken();
}
