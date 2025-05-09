import { clear, getItem, init, removeItem, setItem } from 'node-persist';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { StorageKeys, ZE_PATH } from './storage-keys';
import { getSecretToken } from './secret-token';
import { ze_log } from '../logging';
import * as lockfile from 'proper-lockfile';

// Storage directory path
const storageDir = join(homedir(), ZE_PATH);

// Get the path for the specific storage file
const getStorageFilePath = (key: string): string => {
  return join(storageDir, key);
};

// Path for the lockfile
const tokenLockPath = join(storageDir, `${StorageKeys.ze_auth_token}.lock`);

const storage = init({
  dir: storageDir,
  forgiveParseErrors: true, // Handle corrupted storage files gracefully
});

/** Save token with file locking to prevent race conditions between processes */
export async function saveToken(token: string): Promise<void> {
  let release;
  try {
    // Make sure the directory exists before acquiring lock
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }

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
    ze_log(
      'warn',
      'Failed to acquire lock for token saving, proceeding without lock',
      error
    );
    await storage;
    await setItem(StorageKeys.ze_auth_token, token);
  } finally {
    // Release the lock if we acquired it
    if (release) {
      try {
        await release();
      } catch (error) {
        console.error(error);
      }
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

  // Try up to 3 times to read the token from storage
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 500; // ms

  // it might not make sense to retry here, but it's here to prevent race conditions crashes node-persist
  // without this part it would crash on single process startup
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await storage;
      const token = await getItem(StorageKeys.ze_auth_token);
      if (attempt > 1) {
        ze_log('debug', `Successfully retrieved token on attempt ${attempt}`);
      }
      return token;
    } catch (error) {
      ze_log('warn', `Error reading token (attempt ${attempt}/${MAX_RETRIES})`, error);
      console.error(error);

      if (attempt < MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      }
    }
  }

  ze_log('error', `Failed to read token after ${MAX_RETRIES} attempts`);
  return undefined;
}

/** Remove token with file locking */
export async function removeToken(): Promise<void> {
  let release;
  try {
    // Make sure the directory exists before acquiring lock
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }

    // Acquire a lock before removing the token
    release = await lockfile.lock(tokenLockPath, {
      stale: 10000,
      retries: 5,
    });

    await storage;
    await removeItem(StorageKeys.ze_auth_token);
    // don't remove the lock file here, remove it when all processes are done
    // await removeItem(StorageKeys.ze_auth_token);
  } catch (error) {
    console.error(error);
    await storage;
    await removeItem(StorageKeys.ze_auth_token);
  } finally {
    // Release the lock if we acquired it
    if (release) {
      try {
        await release();
      } catch (error) {
        console.error(error);
        ze_log('warn', 'Failed to release lock', error);
      }
    }
  }
}

/** Clean all tokens with file locking */
export async function cleanTokens(): Promise<void> {
  let release;
  try {
    // // Make sure the directory exists before acquiring lock
    // if (!existsSync(storageDir)) {
    //   mkdirSync(storageDir, { recursive: true });
    // }

    // Acquire a lock before clearing tokens
    release = await lockfile.lock(tokenLockPath, {
      stale: 10000,
      retries: 5,
    });

    await storage;
    await clear();

    ze_log('cleanTokens: Tokens cleared successfully with lock');
  } catch (error) {
    console.error(error);
    await storage;
    await clear();
  } finally {
    // Release the lock if we acquired it
    if (release) {
      try {
        await release();
      } catch (error) {
        console.error(error);
        ze_log('warn', 'Failed to release lock', error);
      }
    }
  }
}

/**
 * Repairs corrupted storage files by removing and reinitializing them Can be used to fix
 * "does not look like a valid storage file" errors
 */
export async function repairStorageFile(key: string): Promise<boolean> {
  const filePath = getStorageFilePath(key);
  let release;
  let success = false;

  try {
    // Make sure the directory exists
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }

    // Try to get a lock on the file
    try {
      release = await lockfile.lock(filePath + '.lock', {
        stale: 5000,
        retries: 3,
      });
    } catch (lockError) {
      ze_log(
        'warn',
        `Unable to acquire lock for ${key}, proceeding with caution`,
        lockError
      );
    }

    // If file exists, try to remove it
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
        ze_log('info', `Removed corrupted storage file: ${filePath}`);
      } catch (removeError) {
        ze_log('error', `Failed to remove corrupted file: ${filePath}`, removeError);
        return false;
      }
    }

    // Create a new empty valid JSON file
    try {
      writeFileSync(filePath, '{}', 'utf8');
      ze_log('info', `Created new empty storage file: ${filePath}`);
      success = true;
    } catch (createError) {
      ze_log('error', `Failed to create new storage file: ${filePath}`, createError);
      return false;
    }

    return success;
  } finally {
    // Release the lock if we acquired it
    if (release) {
      try {
        await release();
      } catch (error) {
        ze_log('warn', 'Failed to release lock', error);
      }
    }
  }
}

/**
 * Utility function to fix corrupted auth token file Use this when encountering "does not
 * look like a valid storage file" errors
 */
export async function fixAuthTokenStorage(): Promise<boolean> {
  ze_log('info', 'Attempting to repair auth token storage file');
  return repairStorageFile(StorageKeys.ze_auth_token);
}
