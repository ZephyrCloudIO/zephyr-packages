import { clear, getItem, init, removeItem, setItem } from 'node-persist';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { StorageKeys, ZE_PATH } from './storage-keys';
import { getSecretToken } from './secret-token';
import { ze_log } from '../logging';
import * as lockfile from 'proper-lockfile';

// Storage directory path
const storageDir = join(homedir(), ZE_PATH);

// Path for the lockfile
const tokenLockPath = join(storageDir, `${StorageKeys.ze_auth_token}.lock`);

// Make storage initialization lazy and synchronized
const storage = init({
  dir: storageDir,
});

/** Save token with file locking to prevent race conditions between processes */
export async function saveToken(token: string): Promise<void> {
  let release;
  try {
    // Acquire a lock before writing the token
    // stale: 10000 (10s) - consider a lock stale after 10s (if process crashed)
    // retries: 5 - attempt to acquire the lock 5 times
    // retryWait: 500 - wait 500ms between retries
    release = await lockfile.lock(tokenLockPath, {
      stale: 10000,
      retries: 5,
    });

    // Once we have the lock, save the token
    await storage;
    await setItem(StorageKeys.ze_auth_token, token);
  } catch (error) {
    // If we couldn't acquire the lock after retries, log and still try to save
    ze_log('saveToken: Could not acquire lock, attempting to save anyway', error);
    await storage;
    await setItem(StorageKeys.ze_auth_token, token);
  } finally {
    // Release the lock if we acquired it
    if (release) {
      await release();
    }
  }
}

/** Get token with minimal locking - we only need read access */
export async function getToken(): Promise<string | undefined> {
  ze_log('getToken: Getting token...');
  const tokenFromEnv = getSecretToken();

  if (tokenFromEnv) {
    return tokenFromEnv;
  }

  await storage;
  return getItem(StorageKeys.ze_auth_token);
}

/** Remove token with file locking */
export async function removeToken(): Promise<void> {
  let release;
  try {
    // Acquire a lock before removing the token
    release = await lockfile.lock(tokenLockPath, {
      stale: 10000,
      retries: 5,
    });

    await storage;
    await removeItem(StorageKeys.ze_auth_token);

    ze_log('removeToken: Token removed successfully with lock');
  } catch (error) {
    // If we couldn't acquire the lock after retries, log and still try to remove
    ze_log('removeToken: Could not acquire lock, attempting to remove anyway', error);
    await storage;
    await removeItem(StorageKeys.ze_auth_token);
  } finally {
    // Release the lock if we acquired it
    if (release) {
      await release();
    }
  }
}

/** Clean all tokens with file locking */
export async function cleanTokens(): Promise<void> {
  let release;
  try {
    // Acquire a lock before clearing tokens
    release = await lockfile.lock(tokenLockPath, {
      stale: 10000,
      retries: 5,
    });

    await storage;
    await clear();

    ze_log('cleanTokens: Tokens cleared successfully with lock');
  } catch (error) {
    // If we couldn't acquire the lock after retries, log and still try to clear
    ze_log('cleanTokens: Could not acquire lock, attempting to clear anyway', error);
    await storage;
    await clear();
  } finally {
    // Release the lock if we acquired it
    if (release) {
      await release();
    }
  }
}
