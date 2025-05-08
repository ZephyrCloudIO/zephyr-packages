import { clear, getItem, init, removeItem, setItem } from 'node-persist';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { ze_log } from '../logging';
import { StorageKeys, ZE_PATH } from './storage-keys';
import { getSecretToken } from './secret-token';

// Track if we've set up the process exit handlers
let exitHandlersInitialized = false;

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

/** Setup process exit handlers to clean up the auth lock if the process exits */
function setupExitHandlers() {
  if (exitHandlersInitialized) return;

  // Remove auth lock when process exits, is killed, or crashes
  const cleanupOnExit = async () => {
    try {
      // Check if we hold the lock
      const existingLock = await getItem(StorageKeys.ze_auth_in_progress);
      if (existingLock) {
        const lockInfo = JSON.parse(existingLock);
        if (lockInfo.pid === process.pid) {
          ze_log('Cleaning up auth lock on process exit');
          await removeAuthInProgressLock();
        }
      }
    } catch (err) {
      // Just log errors during cleanup
      ze_log(`Error cleaning up auth lock: ${err}`);
    }
  };

  // Clean up on normal exit and exceptions
  process.on('exit', () => {
    // On 'exit' we must use synchronous code, but we can't really do much here
    // as async storage operations won't work, but the OS will clean up the process anyway
  });

  // For these signals we can do async cleanup
  process.on('SIGINT', async () => {
    await cleanupOnExit();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await cleanupOnExit();
    process.exit(0);
  });

  process.on('uncaughtException', async (err) => {
    ze_log(`Uncaught exception: ${err}`);
    await cleanupOnExit();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason) => {
    ze_log(`Unhandled rejection: ${reason}`);
    await cleanupOnExit();
    // Not exiting here, as unhandled rejections might be handled later
  });

  exitHandlersInitialized = true;
}

/**
 * Sets a lock indicating authentication is in progress Returns true if lock was acquired,
 * false if already locked
 */
export async function setAuthInProgressLock(timeoutMs = 60000): Promise<boolean> {
  await storage;

  // Setup exit handlers to clean up locks on process exit
  setupExitHandlers();

  // Check if lock exists
  const existingLock = await getItem(StorageKeys.ze_auth_in_progress);
  if (existingLock) {
    try {
      const lockInfo = JSON.parse(existingLock);
      const now = Date.now();

      // If lock is not expired, return false (couldn't acquire lock)
      if (lockInfo.expiresAt > now) {
        // Check if the process that holds the lock is still alive
        // This is a best-effort check as it only works on the same machine
        try {
          // On Unix-like systems, we can check if the process exists
          if (process.platform !== 'win32') {
            process.kill(lockInfo.pid, 0); // This throws if process doesn't exist
          }

          // Process exists, respect the lock
          return false;
        } catch {
          // Process doesn't exist, clean up the stale lock
          ze_log(`Cleaning up stale lock from non-existent process ${lockInfo.pid}`);
          await removeAuthInProgressLock();
          // Continue to acquire the lock below
        }
      }
    } catch {
      // If there's an error parsing the lock, clean it up
      ze_log('Cleaning up invalid lock data');
      await removeAuthInProgressLock();
      // Continue to acquire the lock below
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
 * Checks for stale or corrupted authentication locks and cleans them. A lock is
 * considered stale if:
 *
 * - The data is corrupted (not valid JSON)
 * - The process that created it no longer exists
 * - The lock has expired (handled by TTL, but we check just in case) a *
 *
 * @returns True if a stale lock was found and cleaned, false otherwise
 */
export async function cleanStaleAuthLock(): Promise<boolean> {
  await storage;

  const existingLock = await getItem(StorageKeys.ze_auth_in_progress);
  if (!existingLock) {
    return false;
  }

  try {
    const lockInfo = JSON.parse(existingLock);

    // Set up exit handlers if not already done
    setupExitHandlers();

    // Check if the lock has expired (should be handled by TTL, but just in case)
    if (lockInfo.expiresAt && lockInfo.expiresAt <= Date.now()) {
      ze_log(`Cleaning up expired authentication lock from process ${lockInfo.pid}`);
      await removeAuthInProgressLock();
      return true;
    }

    // Check if the process that holds the lock is still alive
    if (lockInfo.pid) {
      try {
        // On Unix-like systems, we can check if the process exists
        if (process.platform !== 'win32') {
          process.kill(lockInfo.pid, 0); // This throws if process doesn't exist
        }

        // Process exists, lock is still valid
        return false;
      } catch {
        // Process doesn't exist, clean up the stale lock
        ze_log(`Cleaning up stale lock from non-existent process ${lockInfo.pid}`);
        await removeAuthInProgressLock();
        return true;
      }
    }

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
  let consecutiveNoLockChecks = 0;
  const maxNoLockChecks = 3; // Number of consecutive times we don't see a lock before giving up

  while (Date.now() - startTime < timeoutMs) {
    // First check if we already have a valid token
    const token = await getToken();
    if (token) {
      return token;
    }

    // Check if auth is still in progress
    const authInProgress = await isAuthInProgress();

    if (!authInProgress) {
      // No auth in progress, but no token either
      // If we see this multiple times in a row, the other process might have failed
      consecutiveNoLockChecks++;

      if (consecutiveNoLockChecks >= maxNoLockChecks) {
        // After several consecutive checks with no lock and no token,
        // assume the other process failed silently
        return undefined;
      }
    } else {
      // Reset the counter if we see auth in progress
      consecutiveNoLockChecks = 0;
    }

    // Wait for the poll interval before checking again
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  // Timeout reached without getting a token
  return undefined;
}
