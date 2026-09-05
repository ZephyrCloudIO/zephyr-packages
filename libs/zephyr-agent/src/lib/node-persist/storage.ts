import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { writeFileAtomically } from './atomic-file';
import { ensurePrivateFilePermissions, ZE_STORAGE_PATH } from './storage-keys';

interface StoredDatum {
  key: string;
  value: unknown;
  ttl?: number | null;
}

interface SetItemOptions {
  ttl?: number;
}

function datumPath(directory: string, key: string): string {
  const digest = createHash('sha256').update(key).digest('hex');
  return join(directory, digest);
}

function parseDatum(content: string): StoredDatum | undefined {
  try {
    const datum = JSON.parse(content) as Partial<StoredDatum>;
    return typeof datum.key === 'string' && datum.key
      ? (datum as StoredDatum)
      : undefined;
  } catch {
    return;
  }
}

function isExpired(datum: StoredDatum): boolean {
  return typeof datum.ttl === 'number' && datum.ttl < Date.now();
}

export function createPersistentStore(directory: string) {
  const ready = mkdir(directory, { recursive: true, mode: 0o700 }).then(() => undefined);

  async function readDatum(key: string): Promise<StoredDatum | undefined> {
    await ready;
    try {
      return parseDatum(await readFile(datumPath(directory, key), 'utf8'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }

  async function getItem<T = unknown>(key: string): Promise<T | undefined> {
    const datum = await readDatum(key);
    if (!datum) return;
    if (isExpired(datum)) {
      await removeItem(key);
      return;
    }
    return datum.value as T;
  }

  async function setItem(
    key: string,
    value: unknown,
    options: SetItemOptions = {}
  ): Promise<{ file: string }> {
    await ready;
    const file = datumPath(directory, key);
    const ttl = options.ttl ? Date.now() + options.ttl : undefined;
    await writeFileAtomically(file, JSON.stringify({ key, value, ttl }));
    ensurePrivateFilePermissions(file);
    return { file };
  }

  async function removeItem(key: string): Promise<void> {
    await ready;
    await rm(datumPath(directory, key), { force: true });
  }

  async function data(): Promise<StoredDatum[]> {
    await ready;
    const entries = await readdir(directory, { withFileTypes: true });
    const values: StoredDatum[] = [];
    for (const entry of entries) {
      if (!entry.isFile() || entry.name.startsWith('.')) continue;
      try {
        const datum = parseDatum(await readFile(join(directory, entry.name), 'utf8'));
        if (!datum) continue;
        if (isExpired(datum)) {
          await removeItem(datum.key);
          continue;
        }
        values.push(datum);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
    return values;
  }

  async function keys(): Promise<string[]> {
    return (await data()).map(({ key }) => key);
  }

  async function forEachItem(
    callback: (entry: { key: string; value: unknown }) => void | Promise<void>
  ): Promise<void> {
    for (const { key, value } of await data()) {
      await callback({ key, value });
    }
  }

  return { ready, getItem, setItem, removeItem, keys, forEachItem };
}

const persistentStore = createPersistentStore(ZE_STORAGE_PATH);

/** @internal */
export const storage = persistentStore.ready;
export const getItem = persistentStore.getItem;
export const setItem = persistentStore.setItem;
export const removeItem = persistentStore.removeItem;
export const keys = persistentStore.keys;
export const forEachItem = persistentStore.forEachItem;

/** Persist a credential-bearing value and fail if its resulting file is not private. */
export async function setPrivateItem(
  key: string,
  value: unknown,
  options?: SetItemOptions
): Promise<void> {
  const result = await setItem(key, value, options);
  ensurePrivateFilePermissions(result.file);
}
