import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import { setInterval } from 'node:timers/promises';
import { checkSync, lockSync } from 'proper-lockfile';
import { DEFAULT_AUTH_COMPLETION_TIMEOUT_MS } from '../auth/auth-flags';
import { ze_log } from '../logging';
import { ZE_SESSION_LOCK } from './storage-keys';

// 72 bits of entropy is more than enough (80b to have 50% collisions)
const SESSION_LENGTH = 9;

/**
 * Returns a base64url session key to be used in a login process.
 *
 * This uses a sync-lock to ensure that multiple concurrent login processes uses the same
 * session key so once the first login is completed, the other concurrent logins also get
 * authorized without doing anything else than waiting in the same websocket room.
 */
export function getSessionKey(): SessionLock {
  // crypto.randomBytes might tame some milliseconds, we generate it before locking
  // so we don't create time for concurrency issues to happen between locking and writing
  // the session key to file.
  let session = randomBytes(SESSION_LENGTH);

  const unlock = safeLockSync();

  // Another process has the lock = concurrent login is in progress,
  // use that session key instead
  if (!unlock) {
    ze_log('Lock is already held by another process, using the same session key');
    session = fs.readFileSync(ZE_SESSION_LOCK);

    // A second write here helps solve any concurrency between reading and writing
    // the session key to the lockfile. This is a rare case, but it can happen
    if (session.length !== SESSION_LENGTH) {
      session = fs.readFileSync(ZE_SESSION_LOCK);
    }
  } else {
    ze_log('Lock acquired, writing session key to lockfile');
    // read and write as array buffer
    fs.writeFileSync(ZE_SESSION_LOCK, session, { flush: true });
  }

  return {
    owner: !!unlock,
    session: session.toString('base64url'),
    [Symbol.dispose]() {
      // If we are the holder of the lock, unlock it and clean up the lockfile
      unlock?.();
    },
  };
}

export interface SessionLock extends Disposable {
  readonly owner: boolean;
  readonly session: string;
}

/** @returns Either a function to unlock the lock or null if the lock could not be acquired */
function safeLockSync(createIfNotExists = true): (() => void) | null {
  try {
    // The timeout to the whole login process makes sense to keep the lock for the same amount of time
    return lockSync(ZE_SESSION_LOCK, { stale: DEFAULT_AUTH_COMPLETION_TIMEOUT_MS });
  } catch (error: any) {
    if (error.code === 'ELOCKED') {
      return null;
    }

    // Creates the file if it does not exist
    if (error.code === 'ENOENT' && createIfNotExists) {
      fs.writeFileSync(ZE_SESSION_LOCK, '', 'utf8');
      return safeLockSync(false);
    }

    throw error;
  }
}

/**
 * Checks 4 times per second if the lock is still held by the current process and resolves
 * when the lock is released.
 */
export async function waitForUnlock(signal?: AbortSignal): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  for await (const _ of setInterval(1000 / 4, null, { ref: false, signal })) {
    // Stale works as a timeout for the loop
    if (!checkSync(ZE_SESSION_LOCK, { stale: DEFAULT_AUTH_COMPLETION_TIMEOUT_MS })) {
      return;
    }
  }
}
