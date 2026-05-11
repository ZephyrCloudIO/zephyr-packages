import { StorageKeys } from './storage-keys';

export function getServerToken(): string | undefined {
  return process.env[StorageKeys.ze_server_token]?.trim();
}

export function hasServerToken() {
  return !!getServerToken();
}
