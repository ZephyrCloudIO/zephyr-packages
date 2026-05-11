import { StorageKeys } from './storage-keys';

export function getCiToken(): string | undefined {
  return process.env[StorageKeys.ci_token]?.trim();
}

export function hasCiToken() {
  return !!getCiToken();
}
