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

describe('CacheManager version refresh for unchanged bundles', () => {
  const manifestUrl = 'https://demo-host-acme-ze.zephyrcloud.app/mf-manifest.json';
  const bundleUrl = 'https://demo-host-acme-ze.zephyrcloud.app/exposed/App.bundle';
  const v12 = {
    snapshot_id: 'alice-12.host.repo.acme',
    version_url: 'alice-12-host-acme-ze.zephyrcloud.app',
    published_at: 1700000000000,
  };
  const v13 = {
    snapshot_id: 'alice-13.host.repo.acme',
    version_url: 'alice-13-host-acme-ze.zephyrcloud.app',
    published_at: 1700000100000,
  };
  // Test manifests list their bundle hashes by path.
  const extractHashes = (manifest: unknown, url: string) => {
    const base = url.replace(/\/[^/]*$/, '');
    const { hashes } = manifest as { hashes: Record<string, string> };
    return new Map(Object.entries(hashes).map(([p, h]) => [`${base}/${p}`, h]));
  };
  let current = v12;
  let versionedManifests: Record<string, Record<string, string>> = {};

  beforeEach(() => {
    rs.clearAllMocks();
    nativeCache.fileExists.mockResolvedValue(true);
    nativeCache.writeFile.mockResolvedValue(undefined);
    nativeCache.downloadFile.mockResolvedValue({ sha256: 'same', bytesWritten: 1 });
    current = v12;
    versionedManifests = {};
    globalThis.fetch = rs.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith('/__get_version_info__')) return Response.json(current);
      const hashes = versionedManifests[url];
      return hashes
        ? Response.json({ hashes })
        : new Response('not found', { status: 404 });
    });
  });

  async function cachedAtV12() {
    const manager = new CacheManager();
    await manager.initialize();
    await manager.preDownloadBundle(bundleUrl, 'same');
    expect((await manager.getCachedBundle(bundleUrl))?.metadata.version?.snapshotId).toBe(
      'alice-12.host.repo.acme'
    );
    nativeCache.downloadFile.mockClear();
    return manager;
  }

  it('relabels a bundle a newer version serves byte-for-byte, without downloading it', async () => {
    const manager = await cachedAtV12();
    current = v13;
    versionedManifests['https://alice-13-host-acme-ze.zephyrcloud.app/mf-manifest.json'] =
      { 'exposed/App.bundle': 'same' };

    const hashes = new Map([[bundleUrl, 'same']]);
    expect(await manager.preDownloadBundle(bundleUrl, 'same')).toBe(false);
    const relabeled = await manager.refreshVersions(manifestUrl, hashes, extractHashes);

    expect(relabeled).toHaveLength(1);
    expect(nativeCache.downloadFile).not.toHaveBeenCalled();
    expect((await manager.getCachedBundle(bundleUrl))?.metadata.version).toEqual({
      snapshotId: 'alice-13.host.repo.acme',
      versionUrl: 'alice-13-host-acme-ze.zephyrcloud.app',
      publishedAt: 1700000100000,
    });
  });

  it("keeps the old version when the new version's manifest lists different bytes", async () => {
    // The environment moved to v13 after the update check read the manifest, and v13
    // changed this bundle: the cached file is not v13's.
    const manager = await cachedAtV12();
    current = v13;
    versionedManifests['https://alice-13-host-acme-ze.zephyrcloud.app/mf-manifest.json'] =
      { 'exposed/App.bundle': 'changed' };

    const relabeled = await manager.refreshVersions(
      manifestUrl,
      new Map([[bundleUrl, 'same']]),
      extractHashes
    );

    expect(relabeled).toEqual([]);
    expect((await manager.getCachedBundle(bundleUrl))?.metadata.version?.snapshotId).toBe(
      'alice-12.host.repo.acme'
    );
  });
});
