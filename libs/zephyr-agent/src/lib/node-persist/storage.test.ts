import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@rstest/core';
import { createPersistentStore } from './storage';

describe('persistent storage', () => {
  const directories: string[] = [];

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it('reads existing records and writes compatible replacements', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'zephyr-storage-'));
    directories.push(directory);
    const key = 'ze-auth-token';
    const file = join(directory, createHash('sha256').update(key).digest('hex'));
    writeFileSync(file, JSON.stringify({ key, value: 'existing-token', ttl: null }));
    const store = createPersistentStore(directory);

    await expect(store.getItem(key)).resolves.toBe('existing-token');
    await store.setItem(key, 'replacement-token');
    await expect(store.getItem(key)).resolves.toBe('replacement-token');
  });

  it('removes expired values and ignores malformed records', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'zephyr-storage-expiry-'));
    directories.push(directory);
    const expiredKey = 'expired';
    writeFileSync(
      join(directory, createHash('sha256').update(expiredKey).digest('hex')),
      JSON.stringify({ key: expiredKey, value: 'old', ttl: Date.now() - 1 })
    );
    writeFileSync(join(directory, 'malformed'), '{');
    const store = createPersistentStore(directory);

    await expect(store.getItem(expiredKey)).resolves.toBeUndefined();
    await expect(store.keys()).resolves.toEqual([]);
  });
});
