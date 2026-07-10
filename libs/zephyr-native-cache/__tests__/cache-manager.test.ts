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
