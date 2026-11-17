import { gunzipSync } from 'node:zlib';
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Snapshot, ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { ZeErrors, ZephyrError } from '../../errors';

const mocks = rs.hoisted(() => ({ makeRequest: rs.fn() }));

rs.mock('../../http/http-request', () => ({ makeRequest: mocks.makeRequest }));
rs.mock('../../logging', () => ({ ze_log: { upload: rs.fn() } }));

import { STORE_THRESHOLD_BYTES, uploadStoredAssets } from './upload-stored-assets';

const appConfig = {
  PLATFORM: 'akamai',
  EDGE_URL: 'https://edge.example',
  jwt: 'write-jwt',
};

function asset(path: string, size: number): ZeBuildAsset {
  const buffer = Buffer.alloc(size, path);
  return {
    path,
    extname: path.slice(path.lastIndexOf('.')),
    hash: `hash-${path}`,
    size,
    buffer,
  };
}

function setup(assets: ZeBuildAsset[], platform = 'akamai') {
  const snapshot = {
    assets: Object.fromEntries(
      assets.map(({ path, extname, hash, size }) => [path, { path, extname, hash, size }])
    ),
  } as unknown as Snapshot;
  const assetsMap: ZeBuildAssetsMap = Object.fromEntries(assets.map((a) => [a.hash, a]));
  const engine = {
    application_configuration: Promise.resolve({ ...appConfig, PLATFORM: platform }),
  };
  return { snapshot, assetsMap, engine: engine as never };
}

function notImplemented(): ZephyrError {
  return new ZephyrError(ZeErrors.ERR_ZEPHYR_UNREACHABLE, {
    data: { status: 501 },
  } as never);
}

describe('uploadStoredAssets', () => {
  const big = asset('main.bundle', STORE_THRESHOLD_BYTES + 1);
  const small = asset('small.js', 10);
  const html = asset('index.html', STORE_THRESHOLD_BYTES + 1);

  beforeEach(() => {
    mocks.makeRequest.mockReset();
    mocks.makeRequest.mockImplementation(async (url: unknown) =>
      typeof url === 'string'
        ? [true, null, undefined]
        : [
            true,
            null,
            { url: 'https://bucket.example/put', contentType: 'application/javascript' },
          ]
    );
  });

  it('stores large assets gzipped, records store, and leaves the rest for EdgeKV', async () => {
    const { snapshot, assetsMap, engine } = setup([big, small, html]);

    const remaining = await uploadStoredAssets(engine, snapshot, assetsMap, [
      big,
      small,
      html,
    ]);

    expect(remaining.map((a) => a.path)).toEqual(['small.js', 'index.html']);
    const store = snapshot.assets['main.bundle']?.store;
    expect(store).toMatchObject({ encoding: 'gzip' });
    expect(snapshot.assets['index.html']?.store).toBeUndefined();

    const [presign, put] = mocks.makeRequest.mock.calls;
    expect(presign?.[0]).toMatchObject({
      path: '/upload',
      query: { type: 'uploadUrl', hash: store?.object, filename: 'main.bundle' },
    });
    expect(put?.[1]).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'application/javascript', 'Content-Encoding': 'gzip' },
    });
    const body = put?.[2] as Buffer;
    expect(body.length).toBe(store?.size);
    expect(gunzipSync(body).equals(big.buffer as Buffer)).toBe(true);
  });

  it('keeps every asset for EdgeKV when the worker has no bucket (501)', async () => {
    mocks.makeRequest.mockResolvedValueOnce([false, notImplemented()]);
    const { snapshot, assetsMap, engine } = setup([big, small]);

    const remaining = await uploadStoredAssets(engine, snapshot, assetsMap, [big, small]);

    expect(remaining).toEqual([big, small]);
    expect(snapshot.assets['main.bundle']?.store).toBeUndefined();
    expect(mocks.makeRequest).toHaveBeenCalledTimes(1);
  });

  it('fails the upload and leaves the snapshot untouched when a PUT fails', async () => {
    mocks.makeRequest
      .mockResolvedValueOnce([
        true,
        null,
        { url: 'https://bucket.example/put', contentType: 'x' },
      ])
      .mockResolvedValueOnce([false, new Error('403')]);
    const { snapshot, assetsMap, engine } = setup([big]);

    await expect(
      uploadStoredAssets(engine, snapshot, assetsMap, [big])
    ).rejects.toThrow();
    expect(snapshot.assets['main.bundle']?.store).toBeUndefined();
  });

  it('does nothing on other platforms', async () => {
    const { snapshot, assetsMap, engine } = setup([big], 'cloudflare');

    expect(await uploadStoredAssets(engine, snapshot, assetsMap, [big])).toEqual([big]);
    expect(mocks.makeRequest).not.toHaveBeenCalled();
  });
});
