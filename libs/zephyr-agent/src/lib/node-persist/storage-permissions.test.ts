import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from '@rstest/core';
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

  posixIt('remediates existing directories, storage files, and session keys', () => {
    const root = mkdtempSync(join(tmpdir(), 'zephyr-permissions-'));
    temporaryDirectories.push(root);
    const zephyrPath = join(root, '.zephyr');
    const storagePath = join(zephyrPath, 'storage');
    const sessionPath = join(zephyrPath, 'session');
    const tokenPath = join(storagePath, 'existing-token-record');

    mkdirSync(storagePath, { recursive: true, mode: 0o755 });
    writeFileSync(tokenPath, 'token-record', { mode: 0o644 });
    writeFileSync(sessionPath, 'session-key', { mode: 0o644 });
    chmodSync(zephyrPath, 0o755);
    chmodSync(storagePath, 0o755);
    chmodSync(tokenPath, 0o644);
    chmodSync(sessionPath, 0o644);

    ensurePrivateStoragePermissions(zephyrPath, storagePath, sessionPath);

    expect(statSync(zephyrPath).mode & 0o777).toBe(0o700);
    expect(statSync(storagePath).mode & 0o777).toBe(0o700);
    expect(statSync(tokenPath).mode & 0o777).toBe(0o600);
    expect(statSync(sessionPath).mode & 0o777).toBe(0o600);
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
