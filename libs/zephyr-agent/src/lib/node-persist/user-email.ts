import { StorageKeys } from './storage-keys';

export function getUserEmail(): string | undefined {
  return process.env[StorageKeys.ze_user_email]?.trim();
}

export function hasUserEmail() {
  return !!getUserEmail();
}
