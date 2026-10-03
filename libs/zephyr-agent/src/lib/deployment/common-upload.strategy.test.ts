import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Snapshot, ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../errors';
import { safeStringifyForLogging } from '../security/redaction';

const mocks = rs.hoisted(() => ({
  getApplicationConfiguration: rs.fn(),
  makeRequest: rs.fn(),
  getAppHashCache: rs.fn(),
  setAppHashCache: rs.fn(),
  uploadBuildStatsAndEnableEnvs: rs.fn(),
}));

rs.mock('../edge-requests/get-application-configuration', () => ({
  getApplicationConfiguration: mocks.getApplicationConfiguration,
}));
rs.mock('../http/http-request', () => ({ makeRequest: mocks.makeRequest }));
rs.mock('../node-persist/hash-cache', () => ({
  getAppHashCache: mocks.getAppHashCache,
  setAppHashCache: mocks.setAppHashCache,
}));
rs.mock('./upload-base/upload-build-stats-and-enable-envs', () => ({
  uploadBuildStatsAndEnableEnvs: mocks.uploadBuildStatsAndEnableEnvs,
}));

import { commonUploadStrategy } from './common-upload.strategy';

const EDGE_URL = 'https://edge.example';
const VERSION_URL = 'https://edge.example/version';

const appConfig = {
  application_uid: 'app-id',
  EDGE_URL,
  jwt: 'write-token',
};

function createAssets(count: number): {
  assetsMap: ZeBuildAssetsMap;
  assets: ZeBuildAsset[];
} {
  const assets = Array.from({ length: count }, (_, index) => {
    const buffer = Buffer.from(`asset-${index}`);
    return {
      path: `assets/${index}.js`,
      extname: '.js',
      hash: `hash-${index}`,
      size: buffer.length,
      buffer,
    };
  });
  return {
    assets,
    assetsMap: Object.fromEntries(assets.map((asset) => [asset.hash, asset])),
  };
}

function createEngine() {
  return {
    application_uid: 'app-id',
    env: { isCI: false },
    logger: Promise.resolve(rs.fn()),
    application_configuration: Promise.resolve(appConfig),
  } as never;
}

function snapshotRequest(url: unknown): boolean {
  return url instanceof URL && url.searchParams.get('type') === 'snapshot';
}

function fileUploadHashes(): string[] {
  return mocks.makeRequest.mock.calls
    .filter(([url]) => !(url instanceof URL) && url.query?.type === 'file')
    .map(([url]) => url.query.hash);
}

function snapshotReply(status: number, body: unknown) {
  if (status < 300) {
    return [true, null, body];
  }
  return [
    false,
    new ZephyrError(ZeErrors.ERR_HTTP_ERROR, {
      status,
      url: `${EDGE_URL}/upload`,
      method: 'POST',
      content: typeof body === 'string' ? body : safeStringifyForLogging(body),
    }),
  ];
}

/** Queues the replies of consecutive snapshot uploads; any other request succeeds. */
function mockEdge(...snapshotReplies: [status: number, body: unknown][]) {
  mocks.makeRequest.mockImplementation(async (url: unknown) => {
    if (snapshotRequest(url)) {
      const [status, body] = snapshotReplies.shift() ?? [200, {}];
      return snapshotReply(status, body);
    }
    return [true, null, undefined];
  });
}

async function runStrategy(
  assetsMap: ZeBuildAssetsMap,
  // By default every asset is believed to be uploaded already.
  missingAssets: ZeBuildAsset[] = []
) {
  return commonUploadStrategy(createEngine(), {
    snapshot: { assets: {} } as unknown as Snapshot,
    getDashData: rs.fn(),
    assets: { assetsMap, missingAssets },
  });
}

describe('commonUploadStrategy missing assets recovery', () => {
  const versionReply: [number, unknown] = [200, { urls: { version: VERSION_URL } }];
  const missingReply = (hashes: string[]): [number, unknown] => [
    409,
    { error: 'missing_assets', hashes },
  ];

  beforeEach(() => {
    rs.clearAllMocks();
    mocks.getApplicationConfiguration.mockResolvedValue(appConfig);
    mocks.uploadBuildStatsAndEnableEnvs.mockResolvedValue(undefined);
    let hashCache: { hashes: string[] } | undefined = {
      hashes: ['hash-0', 'hash-1', 'hash-2'],
    };
    mocks.getAppHashCache.mockImplementation(async () => hashCache);
    mocks.setAppHashCache.mockImplementation(async (_key, value) => {
      hashCache = value;
    });
  });

  it('invalidates the cache, uploads the missing files and retries the snapshot', async () => {
    const { assetsMap } = createAssets(3);
    mockEdge(missingReply(['hash-1', 'hash-2']), versionReply);

    await expect(runStrategy(assetsMap)).resolves.toBe(VERSION_URL);

    expect(mocks.setAppHashCache).toHaveBeenCalledWith('app-id-edge.example', {
      hashes: ['hash-0'],
    });
    expect(fileUploadHashes().sort()).toEqual(['hash-1', 'hash-2']);
    expect(
      mocks.makeRequest.mock.calls.filter(([url]) => snapshotRequest(url))
    ).toHaveLength(2);
    expect(mocks.uploadBuildStatsAndEnableEnvs).toHaveBeenCalledWith(expect.anything(), {
      getDashData: expect.any(Function),
      versionUrl: VERSION_URL,
    });
  });

  it('invalidates the cache only after the parallel asset upload settled', async () => {
    const { assetsMap, assets } = createAssets(4);
    let finishAssetUpload: () => void = () => undefined;
    const assetUpload = new Promise<void>((resolve) => {
      finishAssetUpload = resolve;
    });
    mocks.makeRequest.mockImplementation(async (url: unknown) => {
      if (snapshotRequest(url)) {
        const calls = mocks.makeRequest.mock.calls.filter(([u]) => snapshotRequest(u));
        // Release the in-flight upload of the new asset only once the snapshot was
        // rejected, so the restore has to wait for it.
        if (calls.length === 1) {
          setTimeout(finishAssetUpload, 5);
          return snapshotReply(...missingReply(['hash-1']));
        }
        return snapshotReply(...versionReply);
      }
      if (
        !(url instanceof URL) &&
        (url as { query: { hash: string } }).query.hash === 'hash-3'
      ) {
        await assetUpload;
      }
      return [true, null, undefined];
    });

    await expect(runStrategy(assetsMap, [assets[3]!])).resolves.toBe(VERSION_URL);

    expect(fileUploadHashes()).toEqual(['hash-3', 'hash-1']);
    expect(mocks.setAppHashCache).toHaveBeenLastCalledWith('app-id-edge.example', {
      hashes: ['hash-0', 'hash-2', 'hash-3'],
    });
  });

  it('fails with a clear error when the retried snapshot is still rejected', async () => {
    const { assetsMap } = createAssets(3);
    mockEdge(missingReply(['hash-1']), missingReply(['hash-1']));

    const error = await runStrategy(assetsMap).catch((e: unknown) => e);

    expect(ZephyrError.is(error, ZeErrors.ERR_SNAPSHOT_MISSING_ASSETS)).toBe(true);
    expect((error as Error).message).toMatch(/build retention/);
    expect((error as Error).message).toMatch(/rebuild/);
    expect(fileUploadHashes()).toEqual(['hash-1']);
    expect(
      mocks.makeRequest.mock.calls.filter(([url]) => snapshotRequest(url))
    ).toHaveLength(2);
    expect(mocks.uploadBuildStatsAndEnableEnvs).not.toHaveBeenCalled();
  });

  it('fails without uploading when a missing hash is not part of the build', async () => {
    const { assetsMap } = createAssets(1);
    mockEdge(missingReply(['hash-0', 'unknown-hash']));

    const error = await runStrategy(assetsMap).catch((e: unknown) => e);

    expect(ZephyrError.is(error, ZeErrors.ERR_SNAPSHOT_MISSING_ASSETS_NOT_IN_BUILD)).toBe(
      true
    );
    expect(mocks.setAppHashCache).toHaveBeenCalled();
    expect(fileUploadHashes()).toEqual([]);
    expect(
      mocks.makeRequest.mock.calls.filter(([url]) => snapshotRequest(url))
    ).toHaveLength(1);
  });

  it('keeps failing unrelated snapshot errors without retrying', async () => {
    const { assetsMap } = createAssets(2);
    mockEdge([500, 'Internal Server Error']);

    const error = await runStrategy(assetsMap).catch((e: unknown) => e);

    expect(ZephyrError.is(error, ZeErrors.ERR_FAILED_UPLOAD)).toBe(true);
    expect(mocks.setAppHashCache).not.toHaveBeenCalled();
    expect(fileUploadHashes()).toEqual([]);
    expect(
      mocks.makeRequest.mock.calls.filter(([url]) => snapshotRequest(url))
    ).toHaveLength(1);
  });
});
