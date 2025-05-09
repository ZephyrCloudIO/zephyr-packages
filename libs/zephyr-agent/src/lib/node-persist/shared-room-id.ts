import { getItem, init, setItem } from 'node-persist';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import * as lockfile from 'proper-lockfile';
import { StorageKeys, ZE_PATH } from './storage-keys';
import { ze_log } from '../logging';

// Storage directory path
const storageDir = join(homedir(), ZE_PATH);

// Path for the lockfile
const roomIdLockPath = join(storageDir, `${StorageKeys.ze_shared_room_id}.lock`);

const storage = init({
  dir: storageDir,
  forgiveParseErrors: true, // Handle corrupted storage files gracefully
});

/**
 * Gets the shared room ID for websocket communication. If a stored ID exists, returns
 * that. Otherwise, generates and stores a new one.
 */
export async function getSharedRoomId(): Promise<string> {
  // First, try to get an existing room ID
  try {
    await storage;
    const existingId = await getItem(StorageKeys.ze_shared_room_id);

    if (existingId) {
      ze_log('debug', `Found existing shared room ID: ${existingId}`);
      return existingId;
    }
  } catch (error) {
    ze_log(
      'warn',
      'Error reading shared room ID from storage, will generate a new one',
      error
    );
  }

  // No valid ID found, generate and save a new one
  return saveSharedRoomId();
}

/** Generates and saves a new shared room ID with file locking to prevent race conditions */
async function saveSharedRoomId(): Promise<string> {
  // Generate a secure random ID
  const newRoomId = Buffer.from(randomBytes(16)).toString('base64url');

  let release;
  try {
    // Make sure the directory exists before acquiring lock
    if (!existsSync(storageDir)) {
      mkdirSync(storageDir, { recursive: true });
    }

    // Acquire a lock before writing the ID
    release = await lockfile.lock(roomIdLockPath, {
      stale: 10000,
      retries: 5,
    });

    // Check again if another process has already saved an ID while we were waiting
    await storage;
    const checkAgain = await getItem(StorageKeys.ze_shared_room_id);
    if (checkAgain) {
      ze_log(
        'debug',
        `Another process saved a room ID while we were waiting: ${checkAgain}`
      );
      return checkAgain;
    }

    // No ID saved yet, save our generated one
    await setItem(StorageKeys.ze_shared_room_id, newRoomId);
    ze_log('debug', `Generated and saved new shared room ID: ${newRoomId}`);

    return newRoomId;
  } catch (error) {
    ze_log(
      'warn',
      'Failed to acquire lock for saving shared room ID, proceeding without lock',
      error
    );

    // Try one more time to check if an ID exists
    await storage;
    const finalCheck = await getItem(StorageKeys.ze_shared_room_id);
    if (finalCheck) {
      return finalCheck;
    }

    // Still no ID, save without a lock
    await setItem(StorageKeys.ze_shared_room_id, newRoomId);
    return newRoomId;
  } finally {
    // Release the lock if we acquired it
    if (release) {
      try {
        await release();
      } catch (error) {
        ze_log('warn', 'Failed to release lock for shared room ID', error);
      }
    }
  }
}
