import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const nativeCache = rs.hoisted(() => ({
  deleteFile: rs.fn(async () => undefined),
  downloadFile: rs.fn(),
  fileExists: rs.fn(async () => false),
  getDocumentDirectory: rs.fn(async () => '/documents'),
  getFileSize: rs.fn(async () => 0),
  readFile: rs.fn(),
  writeFile: rs.fn(async () => undefined),
}));

rs.mock('../src/NativeMFECache', () => ({ default: nativeCache }));

import { CacheManager } from '../src/CacheManager';

describe('CacheManager persistence and update isolation', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    nativeCache.fileExists.mockResolvedValue(false);
    nativeCache.writeFile.mockResolvedValue(undefined);
    // Not a Zephyr host unless a test says otherwise.
    globalThis.fetch = rs.fn(async () => new Response('not found', { status: 404 }));
  });

  it('uses content-addressed destinations for successive bundle versions', async () => {
    const manager = new CacheManager();
    await manager.initialize();

    const oldPath = await manager.getBundleDestPath(
      'remote',
      'https://edge.example/app.bundle?platform=ios',
      'oldhash'
    );
    const newPath = await manager.getBundleDestPath(
      'remote',
      'https://edge.example/app.bundle?platform=ios',
      'newhash'
    );

    expect(oldPath).not.toBe(newPath);
    expect(oldPath).toContain('.oldhash.bundle');
    expect(newPath).toContain('.newhash.bundle');
  });

  it('deletes the previous verified file only after the new manifest persists', async () => {
    const manager = new CacheManager();
    await manager.initialize();

    await manager.saveBundleToCache('remote', '/cache/old.bundle', {
      bundleUrl: 'https://edge.example/app.bundle',
      bundleHash: 'oldhash',
    });
    nativeCache.fileExists.mockResolvedValue(true);
    await manager.saveBundleToCache('remote', '/cache/new.bundle', {
      bundleUrl: 'https://edge.example/app.bundle',
      bundleHash: 'newhash',
    });

    expect(nativeCache.deleteFile).toHaveBeenCalledWith('/cache/old.bundle');
  });

  it('retains the previous file when persisting replacement metadata fails', async () => {
    const manager = new CacheManager();
    await manager.initialize();
    await manager.saveBundleToCache('remote', '/cache/old.bundle', {
      bundleUrl: 'https://edge.example/app.bundle',
      bundleHash: 'oldhash',
    });
    nativeCache.fileExists.mockResolvedValue(true);
    nativeCache.writeFile.mockRejectedValueOnce(new Error('disk full'));

    await manager.saveBundleToCache('remote', '/cache/new.bundle', {
      bundleUrl: 'https://edge.example/app.bundle',
      bundleHash: 'newhash',
    });

    expect(nativeCache.deleteFile).not.toHaveBeenCalledWith('/cache/old.bundle');
  });

  it('does not overwrite the last known-good file when an update hash is invalid', async () => {
    const manager = new CacheManager();
    await manager.initialize();
    const bundleUrl = 'https://edge.example/app.bundle?platform=ios';
    await manager.saveBundleToCache('remote', '/cache/known-good.bundle', {
      bundleUrl,
      bundleHash: 'oldhash',
    });
    nativeCache.fileExists.mockResolvedValue(true);
    nativeCache.downloadFile.mockResolvedValue({
      sha256: 'unexpected-hash',
      bytesWritten: 100,
    });

    const updated = await manager.preDownloadBundle(bundleUrl, 'expected-hash');

    expect(updated).toBe(false);
    expect(nativeCache.downloadFile).toHaveBeenCalledWith(
      bundleUrl,
      expect.stringContaining('.expected-hash.bundle')
    );
    expect(nativeCache.deleteFile).not.toHaveBeenCalledWith('/cache/known-good.bundle');
  });
});

describe('CacheManager Zephyr version of downloaded bundles', () => {
  const bundleUrl =
    'https://demo-host-acme-ze.zephyrcloud.app/exposed/App.bundle?platform=ios';
  const versionedUrl =
    'https://alice-12-host-acme-ze.zephyrcloud.app/exposed/App.bundle?platform=ios';
  const versionInfo = {
    snapshot_id: 'alice-12.host.repo.acme',
    version_url: 'alice-12-host-acme-ze.zephyrcloud.app',
    published_at: 1700000000000,
  };

  beforeEach(() => {
    rs.clearAllMocks();
    nativeCache.fileExists.mockResolvedValue(true);
    nativeCache.writeFile.mockResolvedValue(undefined);
    globalThis.fetch = rs.fn(async () => Response.json(versionInfo));
  });

  it('downloads from the immutable version URL and records that version', async () => {
    const manager = new CacheManager();
    await manager.initialize();
    nativeCache.downloadFile.mockResolvedValue({ sha256: 'expected', bytesWritten: 1 });

    expect(await manager.preDownloadBundle(bundleUrl, 'expected')).toBe(true);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://demo-host-acme-ze.zephyrcloud.app/__get_version_info__',
      expect.anything()
    );
    expect(nativeCache.downloadFile).toHaveBeenCalledTimes(1);
    expect(nativeCache.downloadFile).toHaveBeenCalledWith(
      versionedUrl,
      expect.any(String)
    );
    expect((await manager.getCachedBundle(bundleUrl))?.metadata.version).toEqual({
      snapshotId: 'alice-12.host.repo.acme',
      versionUrl: 'alice-12-host-acme-ze.zephyrcloud.app',
      publishedAt: 1700000000000,
    });
  });

  it('falls back to the environment URL without a version when the versioned bytes differ', async () => {
    // The environment moved to a newer version after the manifest was read.
    const manager = new CacheManager();
    await manager.initialize();
    nativeCache.downloadFile
      .mockResolvedValueOnce({ sha256: 'other', bytesWritten: 1 })
      .mockResolvedValueOnce({ sha256: 'expected', bytesWritten: 1 });

    expect(await manager.preDownloadBundle(bundleUrl, 'expected')).toBe(true);

    expect(nativeCache.downloadFile.mock.calls.map(([url]) => url)).toEqual([
      versionedUrl,
      bundleUrl,
    ]);
    expect((await manager.getCachedBundle(bundleUrl))?.metadata.version).toBeUndefined();
  });

  it('records no version when the host has no version info', async () => {
    globalThis.fetch = rs.fn(async () => new Response('not found', { status: 404 }));
    const manager = new CacheManager();
    await manager.initialize();
    nativeCache.downloadFile.mockResolvedValue({ sha256: 'expected', bytesWritten: 1 });

    expect(await manager.preDownloadBundle(bundleUrl, 'expected')).toBe(true);

    expect(nativeCache.downloadFile).toHaveBeenCalledWith(bundleUrl, expect.any(String));
    expect((await manager.getCachedBundle(bundleUrl))?.metadata.version).toBeUndefined();
  });
});
