import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@rstest/core';
import nodePersist from 'node-persist';
import {
  ensurePrivateFilePermissions,
  ensurePrivateStoragePermissions,
} from './storage-keys';

const posixIt = process.platform === 'win32' ? it.skip : it;

describe('Zephyr storage permissions', () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  posixIt(
    'remediates existing directories, storage files, locks, and session keys',
    () => {
      const root = mkdtempSync(join(tmpdir(), 'zephyr-permissions-'));
      temporaryDirectories.push(root);
      const zephyrPath = join(root, '.zephyr');
      const storagePath = join(zephyrPath, 'storage');
      const locksPath = join(zephyrPath, 'locks');
      const sessionPath = join(zephyrPath, 'session');
      const tokenPath = join(storagePath, 'existing-token-record');
      const lockPath = join(locksPath, 'partial-assets-lock');

      mkdirSync(storagePath, { recursive: true, mode: 0o755 });
      mkdirSync(locksPath, { recursive: true, mode: 0o755 });
      writeFileSync(tokenPath, 'token-record', { mode: 0o644 });
      writeFileSync(lockPath, '', { mode: 0o644 });
      writeFileSync(sessionPath, 'session-key', { mode: 0o644 });
      chmodSync(zephyrPath, 0o755);
      chmodSync(storagePath, 0o755);
      chmodSync(locksPath, 0o755);
      chmodSync(tokenPath, 0o644);
      chmodSync(lockPath, 0o644);
      chmodSync(sessionPath, 0o644);

      ensurePrivateStoragePermissions(zephyrPath, storagePath, sessionPath, locksPath);

      expect(statSync(zephyrPath).mode & 0o777).toBe(0o700);
      expect(statSync(storagePath).mode & 0o777).toBe(0o700);
      expect(statSync(locksPath).mode & 0o777).toBe(0o700);
      expect(statSync(tokenPath).mode & 0o777).toBe(0o600);
      expect(statSync(lockPath).mode & 0o777).toBe(0o600);
      expect(statSync(sessionPath).mode & 0o777).toBe(0o600);
    }
  );

  it('removes only inactive legacy lock targets from node-persist storage', async () => {
    const root = mkdtempSync(join(tmpdir(), 'zephyr-lock-migration-'));
    temporaryDirectories.push(root);
    const zephyrPath = join(root, '.zephyr');
    const storagePath = join(zephyrPath, 'storage');
    const locksPath = join(zephyrPath, 'locks');
    const sessionPath = join(zephyrPath, 'session');
    const inactiveTarget = join(storagePath, `partial-assets-${'a'.repeat(64)}`);
    const activeTarget = join(storagePath, `partial-assets-${'b'.repeat(64)}`);
    const unrelatedEmptyFile = join(storagePath, 'unrelated-empty-file');

    mkdirSync(storagePath, { recursive: true });
    writeFileSync(inactiveTarget, '');
    writeFileSync(activeTarget, '');
    mkdirSync(`${activeTarget}.lock`);
    writeFileSync(unrelatedEmptyFile, '');

    ensurePrivateStoragePermissions(zephyrPath, storagePath, sessionPath, locksPath);

    expect(existsSync(inactiveTarget)).toBe(false);
    expect(existsSync(activeTarget)).toBe(true);
    expect(existsSync(unrelatedEmptyFile)).toBe(true);

    const staleTime = new Date(Date.now() - 60_000);
    utimesSync(`${activeTarget}.lock`, staleTime, staleTime);
    ensurePrivateStoragePermissions(zephyrPath, storagePath, sessionPath, locksPath);
    expect(existsSync(activeTarget)).toBe(false);
    expect(existsSync(`${activeTarget}.lock`)).toBe(false);

    // Once legacy targets are gone, a valid node-persist record is the only key the
    // isolated store can expose; no empty lock sidecar becomes an undefined key.
    rmSync(unrelatedEmptyFile);
    const isolatedStorage = nodePersist.create({ dir: storagePath });
    await isolatedStorage.init();
    await isolatedStorage.setItem('deployment', { urls: ['https://example.test'] });
    expect(await isolatedStorage.keys()).toEqual(['deployment']);
    expect(readdirSync(storagePath)).toHaveLength(1);
  });

  posixIt('makes newly written credential files owner-only', () => {
    const root = mkdtempSync(join(tmpdir(), 'zephyr-private-file-'));
    temporaryDirectories.push(root);
    const filePath = join(root, 'credential');
    writeFileSync(filePath, 'secret', { mode: 0o644 });
    chmodSync(filePath, 0o644);

    ensurePrivateFilePermissions(filePath);

    expect(statSync(filePath).mode & 0o777).toBe(0o600);
  });
});
