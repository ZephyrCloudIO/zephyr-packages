import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { lock, type LockOptions } from 'proper-lockfile';
import { ze_log } from '../logging/debug';
import { ensurePrivateFilePermissions, ZE_LOCKS_PATH } from './storage-keys';
import { storage } from './storage';

const STORAGE_LOCK_STALE_MS = 60_000;

/**
 * Credential coordination fans out across every plugin process in a monorepo build, so
 * the default budget tolerates a slow holder (~60s of retries) rather than failing fast.
 * Callers guarding multi-step state should pass a shorter budget and keep the default
 * `whenUnavailable: 'throw'`.
 */
const STORAGE_LOCK_RETRIES: LockOptions['retries'] = {
  retries: 120,
  factor: 1.2,
  minTimeout: 25,
  maxTimeout: 500,
  randomize: true,
};

/**
 * What to do when the lock cannot be acquired.
 *
 * - `throw` (default) surfaces the acquisition error.
 * - `proceed` runs the action unlocked. Only correct when losing coordination duplicates
 *   work instead of corrupting state.
 */
export type StorageLockUnavailableBehavior = 'throw' | 'proceed';

export interface StorageLockOptions {
  /** Crash-recovery threshold after which an unrefreshed lock is considered abandoned. */
  staleMs?: number;
  /** Acquisition retry budget. */
  retries?: LockOptions['retries'];
  whenUnavailable?: StorageLockUnavailableBehavior;
}

/** Resolve the stable lock anchor for a named storage lock. */
export function getStorageLockPath(name: string): string {
  return path.join(ZE_LOCKS_PATH, name);
}

/** Run an operation under a crash-recoverable inter-process storage lock. */
export async function withStorageLock<T>(
  name: string,
  action: () => Promise<T>,
  options: StorageLockOptions = {}
): Promise<T> {
  const {
    staleMs = STORAGE_LOCK_STALE_MS,
    retries = STORAGE_LOCK_RETRIES,
    whenUnavailable = 'throw',
  } = options;

  let release: (() => Promise<void>) | undefined;
  try {
    release = await acquireStorageLock(name, staleMs, retries);
  } catch (error) {
    if (whenUnavailable === 'throw') throw error;
    // The caller declared coordination to be an optimization. An exhausted retry budget
    // or an unusable locks directory must not fail the build when the only cost of
    // proceeding is repeating work another process already did.
    ze_log.misc(`Proceeding without the ${name} storage lock:`, error);
  }

  try {
    return await action();
  } finally {
    await release?.();
  }
}

async function acquireStorageLock(
  name: string,
  staleMs: number,
  retries: LockOptions['retries']
): Promise<() => Promise<void>> {
  await storage;
  // Recreate the private boundary if an external cleanup removed it while this process
  // was alive.
  await mkdir(ZE_LOCKS_PATH, { recursive: true, mode: 0o700 });
  const lockPath = getStorageLockPath(name);
  // `realpath: false` means proper-lockfile never opens this path; it is only a stable
  // anchor for the sibling `.lock` directory holding transient ownership. Pre-create it
  // privately so no reader can inherit a umask-widened mode.
  await (await open(lockPath, 'a', 0o600)).close();
  ensurePrivateFilePermissions(lockPath);

  return lock(lockPath, { realpath: false, retries, stale: staleMs });
}
