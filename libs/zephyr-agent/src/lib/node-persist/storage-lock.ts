import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { lock } from 'proper-lockfile';
import { ensurePrivateFilePermissions, ZE_LOCKS_PATH } from './storage-keys';
import { storage } from './storage';

const STORAGE_LOCK_STALE_MS = 60_000;

/** Run an operation under a crash-recoverable inter-process storage lock. */
export async function withStorageLock<T>(
  name: string,
  action: () => Promise<T>
): Promise<T> {
  await storage;
  await mkdir(ZE_LOCKS_PATH, { recursive: true, mode: 0o700 });
  const lockPath = path.join(ZE_LOCKS_PATH, name);
  await (await open(lockPath, 'a', 0o600)).close();
  ensurePrivateFilePermissions(lockPath);

  const release = await lock(lockPath, {
    realpath: false,
    retries: {
      retries: 120,
      factor: 1.2,
      minTimeout: 25,
      maxTimeout: 500,
      randomize: true,
    },
    stale: STORAGE_LOCK_STALE_MS,
  });

  try {
    return await action();
  } finally {
    await release();
  }
}
