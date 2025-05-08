import { clear, getItem, init, removeItem, setItem } from 'node-persist';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ze_log } from '../logging';
import { StorageKeys, ZE_PATH } from './storage-keys';
import { getSecretToken } from './secret-token';

const storage = init({
  dir: join(homedir(), ZE_PATH),
});

export async function saveToken(token: string): Promise<void> {
  await storage;

  // Try to decode the token to get expiration time and set TTL accordingly
  try {
    const jose = await import('jose');
    const decodedToken = jose.decodeJwt(token);

    if (decodedToken.exp) {
      // Calculate TTL as time until expiration in milliseconds
      // Subtract 5 minutes (300,000ms) as a safety buffer
      const expiresAt = decodedToken.exp * 1000; // Convert from seconds to milliseconds
      const now = Date.now();
      const ttl = Math.max(0, expiresAt - now - 300_000); // Ensure non-negative TTL with 5min buffer

      await setItem(StorageKeys.ze_auth_token, token, { ttl });
    } else {
      // If no expiration in token, store without TTL
      await setItem(StorageKeys.ze_auth_token, token);
    }
  } catch {
    // If token can't be decoded, store without TTL
    await setItem(StorageKeys.ze_auth_token, token);
  }

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

  // Use built-in TTL to automatically expire the lock after the timeout
  await setItem(StorageKeys.ze_auth_in_progress, JSON.stringify(lockInfo), {
    ttl: timeoutMs,
  });
  return true;
}

/**
 * Checks if authentication is in progress by another process Returns true if locked,
 * false otherwise
 */
export async function isAuthInProgress(): Promise<boolean> {
  await storage;

  // The item will be automatically removed once expired
  const existingLock = await getItem(StorageKeys.ze_auth_in_progress);
  return !!existingLock;
}

/** Removes the authentication in progress lock */
export async function removeAuthInProgressLock(): Promise<void> {
  await storage;
  await removeItem(StorageKeys.ze_auth_in_progress);
}

/**
 * Checks for corrupted authentication locks and cleans them.
 *
 * @returns True if a corrupted lock was found and cleaned, false otherwise
 */
export async function cleanStaleAuthLock(): Promise<boolean> {
  await storage;

  const existingLock = await getItem(StorageKeys.ze_auth_in_progress);
  if (!existingLock) {
    return false;
  }

  try {
    JSON.parse(existingLock);
    return false;
  } catch {
    // If the lock data is corrupted, clean it up
    ze_log('Cleaning up corrupted authentication lock');
    await removeAuthInProgressLock();
    return true;
  }
}

/**
 * Waits for authentication to complete by another process Polls for a valid token every
 * specified interval Returns the token if found, undefined if timeout reached
 */
export async function waitForAuthToComplete(
  timeoutMs = 120000,
  pollIntervalMs = 500
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
