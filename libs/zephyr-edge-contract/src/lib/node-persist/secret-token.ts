import { StorageKeys } from './storage-keys';

export function getSecretToken(): string | undefined {
  return process.env[StorageKeys.ze_secret_token];
}

export function hasSecretToken() {
  return !!getSecretToken();
}
