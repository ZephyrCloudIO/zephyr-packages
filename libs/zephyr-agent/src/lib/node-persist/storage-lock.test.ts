import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { join } from 'node:path';

const mocks = rs.hoisted(() => ({
  close: rs.fn(),
  ensurePrivateFilePermissions: rs.fn(),
  lock: rs.fn(),
  mkdir: rs.fn(),
  open: rs.fn(),
  release: rs.fn(),
}));

rs.mock('node:fs/promises', () => ({
  mkdir: mocks.mkdir,
  open: mocks.open,
}));
rs.mock('proper-lockfile', () => ({ lock: mocks.lock }));
rs.mock('./storage', () => ({ storage: Promise.resolve() }));
rs.mock('./storage-keys', () => ({
  ensurePrivateFilePermissions: mocks.ensurePrivateFilePermissions,
  ZE_LOCKS_PATH: '/private/locks',
}));

import { withStorageLock } from './storage-lock';

describe('withStorageLock', () => {
  beforeEach(() => {
    rs.resetAllMocks();
    mocks.open.mockResolvedValue({ close: mocks.close });
    mocks.lock.mockResolvedValue(mocks.release);
  });

  it('uses a private retrying inter-process lock and releases it', async () => {
    const lockPath = join('/private/locks', 'auth-token');

    await expect(withStorageLock('auth-token', async () => 'value')).resolves.toBe(
      'value'
    );

    expect(mocks.mkdir).toHaveBeenCalledWith('/private/locks', {
      recursive: true,
      mode: 0o700,
    });
    expect(mocks.open).toHaveBeenCalledWith(lockPath, 'a', 0o600);
    expect(mocks.ensurePrivateFilePermissions).toHaveBeenCalledWith(lockPath);
    expect(mocks.lock).toHaveBeenCalledWith(
      lockPath,
      expect.objectContaining({ realpath: false, retries: expect.any(Object) })
    );
    expect(mocks.release).toHaveBeenCalledTimes(1);
  });

  it('releases the lock when the protected operation fails', async () => {
    await expect(
      withStorageLock('auth-token', async () => {
        throw new Error('write failed');
      })
    ).rejects.toThrow('write failed');

    expect(mocks.release).toHaveBeenCalledTimes(1);
  });

  it('applies caller-supplied stale and retry budgets', async () => {
    const retries = { retries: 8, factor: 1.5, minTimeout: 25, maxTimeout: 500 };

    await withStorageLock('partial-assets-abc', async () => undefined, {
      retries,
      staleMs: 30_000,
    });

    expect(mocks.lock).toHaveBeenCalledWith(
      join('/private/locks', 'partial-assets-abc'),
      {
        realpath: false,
        retries,
        stale: 30_000,
      }
    );
  });

  it('surfaces acquisition failures by default', async () => {
    mocks.lock.mockRejectedValue(new Error('Lock file is already being held'));
    const action = rs.fn(async () => 'value');

    await expect(withStorageLock('auth-token', action)).rejects.toThrow(
      'Lock file is already being held'
    );
    expect(action).not.toHaveBeenCalled();
  });

  it('runs the action unlocked when the caller opts out of failing on contention', async () => {
    mocks.lock.mockRejectedValue(new Error('Lock file is already being held'));

    await expect(
      withStorageLock('auth-token', async () => 'value', { whenUnavailable: 'proceed' })
    ).resolves.toBe('value');
    expect(mocks.release).not.toHaveBeenCalled();
  });

  it('runs the action unlocked when the locks directory is unusable', async () => {
    mocks.mkdir.mockRejectedValue(
      Object.assign(new Error('permission denied'), { code: 'EACCES' })
    );

    await expect(
      withStorageLock('auth-token', async () => 'value', { whenUnavailable: 'proceed' })
    ).resolves.toBe('value');
    expect(mocks.lock).not.toHaveBeenCalled();
  });
});
