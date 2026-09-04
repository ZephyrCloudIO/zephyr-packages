import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const testState = rs.hoisted(() => ({
  files: new Map<string, string>(),
  hashes: new Map<string, string>(),
  downloads: new Map<string, { source: string; hash: string }>(),
}));

const nativeCache = rs.hoisted(() => ({
  deleteFile: rs.fn(async (path: string) => {
    for (const filePath of Array.from(testState.files.keys())) {
      if (filePath === path || filePath.startsWith(`${path}/`)) {
        testState.files.delete(filePath);
        testState.hashes.delete(filePath);
      }
    }
  }),
  downloadFile: rs.fn(async (url: string, path: string) => {
    const download = testState.downloads.get(url);
    if (!download) throw Object.assign(new Error('offline'), { code: 'DOWNLOAD_ERROR' });
    testState.files.set(path, download.source);
    testState.hashes.set(path, download.hash);
    return { sha256: download.hash, bytesWritten: download.source.length };
  }),
  fileExists: rs.fn(async (path: string) =>
    Array.from(testState.files.keys()).some(
      (filePath) => filePath === path || filePath.startsWith(`${path}/`)
    )
  ),
  getCacheDirectory: rs.fn(async () => '/application-support'),
  getDocumentDirectory: rs.fn(async () => '/documents'),
  getFileSize: rs.fn(async () => 0),
  readFile: rs.fn(async (path: string) => {
    const content = testState.files.get(path);
    if (content == null) throw new Error('missing file');
    return content;
  }),
  readVerifiedFile: rs.fn(async (path: string, expectedHash: string) => {
    const source = testState.files.get(path);
    const sha256 = testState.hashes.get(path);
    if (source == null)
      throw Object.assign(new Error('missing file'), { code: 'READ_ERROR' });
    if (sha256 !== expectedHash) {
      throw Object.assign(new Error('integrity failure'), { code: 'HASH_MISMATCH' });
    }
    return { source, sha256 };
  }),
  restart: rs.fn(),
  sha256File: rs.fn(async (path: string) => testState.hashes.get(path) ?? ''),
  sha256String: rs.fn(async (content: string) => {
    let value = 0;
    for (const character of content) value = (value * 31 + character.charCodeAt(0)) >>> 0;
    return value.toString(16).padStart(64, '0');
  }),
  writeFile: rs.fn(async (path: string, content: string) => {
    testState.files.set(path, content);
  }),
}));

rs.mock('../src/NativeMFECache', () => ({ default: nativeCache }));

import { CacheManager } from '../src/CacheManager';
import { BundleCacheLayer } from '../src/BundleCacheLayer';
import { NativeCacheLoadError } from '../src/NativeCacheError';
import type { ManifestRelease } from '../src/types';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);
const HASH_C = 'c'.repeat(64);
const BUNDLE_URL = 'https://edge.example/app.bundle?platform=ios';
const EXPOSED_URL = 'https://edge.example/exposed/card.bundle';

function release(hash: string): ManifestRelease {
  return {
    manifestId: 'remote',
    remoteName: 'remote',
    artifacts: [{ bundleUrl: BUNDLE_URL, expectedHash: hash, kind: 'container' }],
  };
}

describe('CacheManager generation transactions', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    testState.files.clear();
    testState.hashes.clear();
    testState.downloads.clear();
  });

  it('rejects a release with a missing hash before downloading', async () => {
    const manager = new CacheManager();
    await manager.initialize();

    const outcome = await manager.stageGeneration({
      ...release(HASH_A),
      artifacts: [{ bundleUrl: BUNDLE_URL, expectedHash: undefined, kind: 'container' }],
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.reason).toBe('missing-hash');
    expect(nativeCache.downloadFile).not.toHaveBeenCalled();
  });

  it('does not expose a partially downloaded multi-bundle generation', async () => {
    const secondUrl = 'https://edge.example/exposed/card.bundle';
    testState.downloads.set(BUNDLE_URL, { source: 'container', hash: HASH_A });
    testState.downloads.set(secondUrl, { source: 'card', hash: HASH_C });
    const manager = new CacheManager();
    await manager.initialize();

    const outcome = await manager.stageGeneration({
      manifestId: 'remote',
      remoteName: 'remote',
      artifacts: [
        { bundleUrl: BUNDLE_URL, expectedHash: HASH_A, kind: 'container' },
        { bundleUrl: secondUrl, expectedHash: HASH_B, kind: 'exposed' },
      ],
    });

    expect(outcome.status).toBe('failed');
    expect(outcome.reason).toBe('hash-mismatch');
    expect(manager.getAllMetadata()).toEqual([]);
    expect(nativeCache.deleteFile).toHaveBeenCalledWith(
      expect.stringContaining('/staging/')
    );
  });

  it('retains one complete previous generation after promotion', async () => {
    testState.downloads.set(BUNDLE_URL, { source: 'version one', hash: HASH_A });
    const manager = new CacheManager();
    await manager.initialize();
    const firstStage = await manager.stageGeneration(release(HASH_A));
    await manager.activateStagedGeneration(firstStage.manifestId);
    const firstPath = manager.getAllMetadata()[0].filePath;

    testState.downloads.set(BUNDLE_URL, { source: 'version two', hash: HASH_B });
    const secondStage = await manager.stageGeneration(release(HASH_B));
    await manager.activateStagedGeneration(secondStage.manifestId);

    expect(manager.getAllMetadata()[0].bundleHash).toBe(HASH_B);
    expect(testState.files.has(firstPath)).toBe(true);
    const previous = await manager.getVerifiedPreviousBundle(BUNDLE_URL);
    expect(previous?.artifact.bundleHash).toBe(HASH_A);
  });

  it('keeps the old active generation when atomic activation persistence fails', async () => {
    testState.downloads.set(BUNDLE_URL, { source: 'version one', hash: HASH_A });
    const manager = new CacheManager();
    await manager.initialize();
    await manager.stageGeneration(release(HASH_A));
    await manager.activateStagedGeneration('remote');

    testState.downloads.set(BUNDLE_URL, { source: 'version two', hash: HASH_B });
    await manager.stageGeneration(release(HASH_B));
    nativeCache.writeFile.mockRejectedValueOnce(new Error('disk full'));
    const activation = await manager.activateStagedGeneration('remote');

    expect(activation.status).toBe('failed');
    expect(activation.reason).toBe('activation-failure');
    expect(manager.getAllMetadata()[0].bundleHash).toBe(HASH_A);
  });

  it('cleans a staged generation that fails activation-time verification', async () => {
    testState.downloads.set(BUNDLE_URL, { source: 'candidate', hash: HASH_A });
    const manager = new CacheManager();
    await manager.initialize();
    await manager.stageGeneration(release(HASH_A));
    const stagedPath = nativeCache.downloadFile.mock.calls[0][1];
    testState.hashes.set(stagedPath, HASH_B);

    const activation = await manager.activateStagedGeneration('remote');

    expect(activation.status).toBe('failed');
    expect(activation.reason).toBe('activation-failure');
    expect(manager.getAllMetadata()).toEqual([]);
    expect(testState.files.has(stagedPath)).toBe(false);
  });

  it('atomically rolls back to the previous verified generation', async () => {
    testState.downloads.set(BUNDLE_URL, { source: 'version one', hash: HASH_A });
    const manager = new CacheManager();
    await manager.initialize();
    await manager.stageGeneration(release(HASH_A));
    await manager.activateStagedGeneration('remote');
    testState.downloads.set(BUNDLE_URL, { source: 'version two', hash: HASH_B });
    await manager.stageGeneration(release(HASH_B));
    await manager.activateStagedGeneration('remote');

    const outcome = await manager.rollbackGeneration('remote');

    expect(outcome.status).toBe('rolled-back');
    expect(manager.getAllMetadata()[0].bundleHash).toBe(HASH_A);
  });

  it('recovers the old active generation when a staged promotion is interrupted', async () => {
    testState.downloads.set(BUNDLE_URL, { source: 'version one', hash: HASH_A });
    const manager = new CacheManager();
    await manager.initialize();
    await manager.stageGeneration(release(HASH_A));
    await manager.activateStagedGeneration('remote');
    testState.downloads.set(BUNDLE_URL, { source: 'version two', hash: HASH_B });
    await manager.stageGeneration(release(HASH_B));

    const recovered = new CacheManager();
    await recovered.initialize();

    expect(recovered.getAllMetadata()[0].bundleHash).toBe(HASH_A);
  });
});

describe('BundleCacheLayer fail-closed loading', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    testState.files.clear();
    testState.hashes.clear();
    testState.downloads.clear();
    delete (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue;
  });

  it('throws a typed error instead of evaluating when the expected hash is missing', async () => {
    const layer = new BundleCacheLayer({ enablePolling: false });
    layer.registerManifestRelease({
      ...release(HASH_A),
      artifacts: [{ bundleUrl: BUNDLE_URL, expectedHash: undefined, kind: 'container' }],
    });

    await expect(layer.loadBundle(BUNDLE_URL)).rejects.toMatchObject({
      name: 'NativeCacheLoadError',
      reason: 'missing-hash',
    });
    expect(nativeCache.downloadFile).not.toHaveBeenCalled();
  });

  it('rejects a downloaded mismatch without evaluating candidate bytes', async () => {
    testState.downloads.set(BUNDLE_URL, {
      source: 'globalThis.__mfeTestValue = "unverified";',
      hash: HASH_B,
    });
    const layer = new BundleCacheLayer({ enablePolling: false });
    layer.registerManifestRelease(release(HASH_A));

    await expect(layer.loadBundle(BUNDLE_URL)).rejects.toBeInstanceOf(
      NativeCacheLoadError
    );
    expect(
      (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue
    ).toBeUndefined();
  });

  it('preserves the active generation and resets after candidate evaluation fails', async () => {
    testState.downloads.set(BUNDLE_URL, {
      source: 'globalThis.__mfeTestValue = "v1";',
      hash: HASH_A,
    });
    const layer = new BundleCacheLayer({ enablePolling: false });
    layer.registerManifestRelease(release(HASH_A));
    await layer.loadBundle(BUNDLE_URL);

    testState.downloads.set(BUNDLE_URL, {
      source: 'throw new Error("candidate failed");',
      hash: HASH_B,
    });
    layer.registerManifestRelease(release(HASH_B));
    await expect(layer.loadBundle(BUNDLE_URL)).rejects.toMatchObject({
      reason: 'evaluation-failure',
    });

    expect(layer.getLoadedBundles()[0].bundleHash).toBe(HASH_A);
    expect(nativeCache.restart).toHaveBeenCalled();
    expect(
      (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue
    ).toBe('v1');
    await expect(layer.loadBundle(BUNDLE_URL)).rejects.toMatchObject({
      reason: 'runtime-poisoned',
    });
  });

  it('quarantines a rejected generation and uses known-good code after restart', async () => {
    testState.downloads.set(BUNDLE_URL, {
      source: 'globalThis.__mfeTestValue = "v1";',
      hash: HASH_A,
    });
    const firstContext = new BundleCacheLayer({ enablePolling: false });
    firstContext.registerManifestRelease(release(HASH_A));
    await firstContext.loadBundle(BUNDLE_URL);
    testState.downloads.set(BUNDLE_URL, {
      source: 'throw new Error("candidate failed");',
      hash: HASH_B,
    });
    firstContext.registerManifestRelease(release(HASH_B));
    await expect(firstContext.loadBundle(BUNDLE_URL)).rejects.toMatchObject({
      reason: 'evaluation-failure',
    });
    const downloadsBeforeRestart = nativeCache.downloadFile.mock.calls.length;

    const restartedContext = new BundleCacheLayer({ enablePolling: false });
    restartedContext.registerManifestRelease(release(HASH_B));
    const result = await restartedContext.loadBundle(BUNDLE_URL);

    expect(result.status).toBe('cache-hit');
    expect(result.candidateOutcome?.reason).toBe('evaluation-failure');
    expect(nativeCache.downloadFile).toHaveBeenCalledTimes(downloadsBeforeRestart);
    expect(
      (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue
    ).toBe('v1');
  });

  it('quarantines an active generation when a later artifact fails evaluation', async () => {
    const graph = (containerHash: string, exposedHash: string): ManifestRelease => ({
      manifestId: 'remote',
      remoteName: 'remote',
      artifacts: [
        { bundleUrl: BUNDLE_URL, expectedHash: containerHash, kind: 'container' },
        { bundleUrl: EXPOSED_URL, expectedHash: exposedHash, kind: 'exposed' },
      ],
    });
    testState.downloads.set(BUNDLE_URL, {
      source: 'globalThis.__mfeTestValue = "container-v1";',
      hash: HASH_A,
    });
    testState.downloads.set(EXPOSED_URL, {
      source: 'globalThis.__mfeTestValue = "exposed-v1";',
      hash: HASH_A,
    });
    const firstContext = new BundleCacheLayer({ enablePolling: false });
    firstContext.registerManifestRelease(graph(HASH_A, HASH_A));
    await firstContext.loadBundle(BUNDLE_URL);

    testState.downloads.set(BUNDLE_URL, {
      source: 'globalThis.__mfeTestValue = "container-v2";',
      hash: HASH_B,
    });
    testState.downloads.set(EXPOSED_URL, {
      source: 'throw new Error("exposed failed");',
      hash: HASH_C,
    });
    firstContext.registerManifestRelease(graph(HASH_B, HASH_C));
    await firstContext.loadBundle(BUNDLE_URL);
    await expect(firstContext.loadBundle(EXPOSED_URL)).rejects.toMatchObject({
      reason: 'evaluation-failure',
    });
    const downloadsBeforeRestart = nativeCache.downloadFile.mock.calls.length;

    const restartedContext = new BundleCacheLayer({ enablePolling: false });
    restartedContext.registerManifestRelease(graph(HASH_B, HASH_C));
    const result = await restartedContext.loadBundle(EXPOSED_URL);

    expect(result.status).toBe('cache-hit');
    expect(result.candidateOutcome?.reason).toBe('evaluation-failure');
    expect(nativeCache.downloadFile).toHaveBeenCalledTimes(downloadsBeforeRestart);
    expect(
      (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue
    ).toBe('exposed-v1');
  });

  it('does not execute an active bundle when the current manifest hash is invalid', async () => {
    testState.downloads.set(BUNDLE_URL, {
      source: 'globalThis.__mfeTestValue = "v1";',
      hash: HASH_A,
    });
    const layer = new BundleCacheLayer({ enablePolling: false });
    layer.registerManifestRelease(release(HASH_A));
    await layer.loadBundle(BUNDLE_URL);
    (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue =
      'sentinel';
    layer.registerManifestRelease({
      ...release(HASH_A),
      artifacts: [{ bundleUrl: BUNDLE_URL, expectedHash: 'invalid', kind: 'container' }],
    });

    await expect(layer.loadBundle(BUNDLE_URL)).rejects.toMatchObject({
      reason: 'malformed-hash',
    });
    expect(
      (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue
    ).toBe('sentinel');
  });

  it('does not execute an active bundle when the current manifest hash is missing', async () => {
    testState.downloads.set(BUNDLE_URL, {
      source: 'globalThis.__mfeTestValue = "v1";',
      hash: HASH_A,
    });
    const layer = new BundleCacheLayer({ enablePolling: false });
    layer.registerManifestRelease(release(HASH_A));
    await layer.loadBundle(BUNDLE_URL);
    (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue =
      'sentinel';
    layer.registerManifestRelease({
      ...release(HASH_A),
      artifacts: [{ bundleUrl: BUNDLE_URL, expectedHash: undefined, kind: 'container' }],
    });

    await expect(layer.loadBundle(BUNDLE_URL)).rejects.toMatchObject({
      reason: 'missing-hash',
    });
    expect(
      (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue
    ).toBe('sentinel');
  });

  it('smoke-validates every artifact before evaluating or activating a generation', async () => {
    testState.downloads.set(BUNDLE_URL, {
      source: 'globalThis.__mfeTestValue = "candidate";',
      hash: HASH_A,
    });
    testState.downloads.set(EXPOSED_URL, {
      source: 'function {',
      hash: HASH_B,
    });
    const layer = new BundleCacheLayer({ enablePolling: false });
    layer.registerManifestRelease({
      manifestId: 'remote',
      remoteName: 'remote',
      artifacts: [
        { bundleUrl: BUNDLE_URL, expectedHash: HASH_A, kind: 'container' },
        { bundleUrl: EXPOSED_URL, expectedHash: HASH_B, kind: 'exposed' },
      ],
    });

    await expect(layer.loadBundle(BUNDLE_URL)).rejects.toMatchObject({
      reason: 'evaluation-failure',
    });
    expect(layer.getLoadedBundles()).toEqual([]);
    expect(
      (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue
    ).toBeUndefined();
  });

  it('rehashes active bytes before execution and rolls back corrupted cache', async () => {
    testState.downloads.set(BUNDLE_URL, {
      source: 'globalThis.__mfeTestValue = "v1";',
      hash: HASH_A,
    });
    const layer = new BundleCacheLayer({ enablePolling: false });
    layer.registerManifestRelease(release(HASH_A));
    await layer.loadBundle(BUNDLE_URL);

    testState.downloads.set(BUNDLE_URL, {
      source: 'globalThis.__mfeTestValue = "v2";',
      hash: HASH_B,
    });
    layer.registerManifestRelease(release(HASH_B));
    await layer.loadBundle(BUNDLE_URL);
    const activePath = layer.getLoadedBundles()[0].filePath;
    testState.hashes.set(activePath, HASH_C);

    const result = await layer.loadBundle(BUNDLE_URL);

    expect(result.outcome.status).toBe('rolled-back');
    expect(result.candidateOutcome?.reason).toBe('corrupt-cache');
    expect(layer.getLoadedBundles()[0].bundleHash).toBe(HASH_A);
    expect(
      (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue
    ).toBe('v1');
  });

  it('uses the persisted verified generation on an offline restart', async () => {
    testState.downloads.set(BUNDLE_URL, {
      source: 'globalThis.__mfeTestValue = "offline";',
      hash: HASH_A,
    });
    const firstLayer = new BundleCacheLayer({ enablePolling: false });
    firstLayer.registerManifestRelease(release(HASH_A));
    await firstLayer.loadBundle(BUNDLE_URL);
    delete (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue;

    const restartedLayer = new BundleCacheLayer({ enablePolling: false });
    const result = await restartedLayer.loadBundle(BUNDLE_URL);

    expect(result.status).toBe('cache-hit');
    expect(
      (globalThis as typeof globalThis & { __mfeTestValue?: string }).__mfeTestValue
    ).toBe('offline');
  });

  it('serializes polling and cache clearing', async () => {
    let releaseDownload!: () => void;
    const downloadGate = new Promise<void>((resolve) => {
      releaseDownload = resolve;
    });
    nativeCache.downloadFile.mockImplementationOnce(async (url: string, path: string) => {
      await downloadGate;
      testState.files.set(path, 'candidate');
      testState.hashes.set(path, HASH_B);
      return { sha256: HASH_B, bytesWritten: 9 };
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = rs.fn(
      async () => ({ ok: true, json: async () => ({ version: 2 }) }) as Response
    );
    const layer = new BundleCacheLayer({ enablePolling: false });
    layer.registerManifestRelease(release(HASH_A));
    layer.registerManifestSource(
      'https://edge.example/mf-manifest.json',
      () => release(HASH_B),
      release(HASH_A)
    );

    const poll = layer.checkForUpdates();
    await Promise.resolve();
    const clear = layer.clearCache();
    releaseDownload();
    const pollResult = await poll;
    await clear;
    globalThis.fetch = originalFetch;

    expect(pollResult.outcomes[0].status).toBe('staged');
    expect(layer.getLoadedBundles()).toEqual([]);
    expect(
      Array.from(testState.files.keys()).some((path) => path.includes('/staging/'))
    ).toBe(false);
  });
});
