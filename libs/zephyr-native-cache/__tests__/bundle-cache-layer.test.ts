import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

const nativeCache = rs.hoisted(() => ({
  deleteFile: rs.fn(async () => undefined),
  downloadFile: rs.fn(),
  fileExists: rs.fn(async () => false),
  getDocumentDirectory: rs.fn(async () => '/documents'),
  getFileSize: rs.fn(async () => 0),
  readFile: rs.fn(async () => ''),
  writeFile: rs.fn(async () => undefined),
  restart: rs.fn(),
}));

rs.mock('../src/NativeMFECache', () => ({ default: nativeCache }));

import { BundleCacheLayer } from '../src/BundleCacheLayer';

const MANIFEST_URL = 'https://edge.example/mf-manifest.json';
const CONTAINER_URL = 'https://edge.example/remote.container.bundle?platform=ios';
const LAZY_URL = 'https://edge.example/exposed/HydrationCard.bundle?platform=ios';

describe('BundleCacheLayer.checkForUpdates', () => {
  const originalFetch = globalThis.fetch;
  let manifestHashes: Map<string, string>;

  beforeEach(() => {
    rs.clearAllMocks();
    nativeCache.fileExists.mockResolvedValue(false);
    (globalThis as { __ZEPHYR__?: unknown }).__ZEPHYR__ = undefined;
    globalThis.fetch = rs.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    // downloadFile reports the hash the manifest currently advertises for that URL
    nativeCache.downloadFile.mockImplementation(async (url: string) => ({
      sha256: manifestHashes.get(url),
      bytesWritten: 1,
    }));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function coldStart(): Promise<BundleCacheLayer> {
    const layer = new BundleCacheLayer();
    manifestHashes = new Map([
      [CONTAINER_URL, 'container-v1'],
      [LAZY_URL, 'lazy-v1'],
    ]);
    layer.registerBundleHash(CONTAINER_URL, 'container-v1');
    layer.registerManifestSource(MANIFEST_URL, () => new Map(manifestHashes));
    expect(await layer.loadBundle(CONTAINER_URL)).toEqual({ status: 'downloaded' });
    nativeCache.fileExists.mockResolvedValue(true);
    return layer;
  }

  it('prefetches never-loaded lazy bundles without reporting an update', async () => {
    const layer = await coldStart();
    const onUpdate = rs.fn();
    layer.events.on('update:available', onUpdate);

    const result = await layer.checkForUpdates();

    expect(result.updated).toBe(0);
    expect(onUpdate).not.toHaveBeenCalled();
    expect(layer.getStatus().pendingUpdates).toEqual([]);
    expect(nativeCache.downloadFile).toHaveBeenCalledWith(LAZY_URL, expect.any(String));
  });

  it('reports an update when a loaded bundle hash changes', async () => {
    const layer = await coldStart();
    const onUpdate = rs.fn();
    layer.events.on('update:available', onUpdate);
    manifestHashes.set(CONTAINER_URL, 'container-v2');

    const result = await layer.checkForUpdates();

    expect(result.updated).toBe(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ oldHash: 'container-v1', newHash: 'container-v2' })
    );
    expect(layer.getStatus().pendingUpdates).toEqual(['remote']);
  });

  it('reports an update for a bundle that loaded through the network fallback', async () => {
    const layer = new BundleCacheLayer();
    manifestHashes = new Map([[CONTAINER_URL, 'container-v1']]);
    layer.registerManifestSource(MANIFEST_URL, () => new Map(manifestHashes));
    // No registered hash: the cache skips and register.ts evaluates it from the network.
    expect(await layer.loadBundle(CONTAINER_URL)).toEqual({ status: 'skipped' });
    const onUpdate = rs.fn();
    layer.events.on('update:available', onUpdate);

    expect((await layer.checkForUpdates()).updated).toBe(0);
    expect(onUpdate).not.toHaveBeenCalled();

    nativeCache.fileExists.mockResolvedValue(true);
    manifestHashes.set(CONTAINER_URL, 'container-v2');
    const result = await layer.checkForUpdates();

    expect(result.updated).toBe(1);
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ oldHash: 'container-v1', newHash: 'container-v2' })
    );
    expect(layer.getStatus().pendingUpdates).toEqual(['remote']);
  });
});
