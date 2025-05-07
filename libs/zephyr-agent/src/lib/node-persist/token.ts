import { clear, getItem, init, removeItem, setItem } from 'node-persist';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { StorageKeys, ZE_PATH } from './storage-keys';
import { getSecretToken } from './secret-token';

const storage = init({
  dir: join(homedir(), ZE_PATH),
});

export async function saveToken(token: string): Promise<void> {
  await storage;
  await setItem(StorageKeys.ze_auth_token, token);
  await removeAuthInProgressLock();
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

/**
 * Sets a lock indicating authentication is in progress Returns true if lock was acquired,
 * false if already locked
 */
export async function setAuthInProgressLock(timeoutMs = 60000): Promise<boolean> {
  await storage;

  // Check if lock exists
  const existingLock = await getItem(StorageKeys.ze_auth_in_progress);
  if (existingLock) {
    const lockInfo = JSON.parse(existingLock);
    const now = Date.now();

    // If lock is not expired, return false (couldn't acquire lock)
    if (lockInfo.expiresAt > now) {
      return false;
    }
  }

  // Set or refresh the lock
  const lockInfo = {
    timestamp: Date.now(),
    expiresAt: Date.now() + timeoutMs,
    pid: process.pid,
  };

  await setItem(StorageKeys.ze_auth_in_progress, JSON.stringify(lockInfo));
  return true;
}

/**
 * Checks if authentication is in progress by another process Returns true if locked,
 * false otherwise
 */
export async function isAuthInProgress(): Promise<boolean> {
  await storage;

  const existingLock = await getItem(StorageKeys.ze_auth_in_progress);
  if (!existingLock) {
    return false;
  }

  const lockInfo = JSON.parse(existingLock);
  const now = Date.now();

  // Return true only if lock exists and is not expired
  return lockInfo.expiresAt > now;
}

/** Removes the authentication in progress lock */
export async function removeAuthInProgressLock(): Promise<void> {
  await storage;
  await removeItem(StorageKeys.ze_auth_in_progress);
}

/**
 * Waits for authentication to complete by another process Polls for a valid token every
 * specified interval Returns the token if found, undefined if timeout reached
 */
export async function waitForAuthToComplete(
  timeoutMs = 120000,
  pollIntervalMs = 1000
): Promise<string | undefined> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    // Check if auth is still in progress
    if (!(await isAuthInProgress())) {
      // Auth is no longer in progress, check for token
      const token = await getToken();
      if (token) {
        return token;
      }
    }

    // Wait for the poll interval before checking again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout reached without getting a token
  return undefined;
}
