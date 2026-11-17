import { createHash } from 'node:crypto';
import { gunzipSync, gzip } from 'node:zlib';
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Snapshot, ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';

const mocks = rs.hoisted(() => ({ fetchWithRetries: rs.fn() }));

// The real `makeRequest` runs, so the edge's answers reach the code as the real errors.
rs.mock('../../http/fetch-with-retries', () => ({
  fetchWithRetries: mocks.fetchWithRetries,
}));
rs.mock('../../logging', () => ({ ze_log: { upload: rs.fn() } }));
rs.mock('node:zlib', { spy: true });

import { STORE_THRESHOLD_BYTES, uploadStoredAssets } from './upload-stored-assets';

const PRESIGNED = { url: 'https://bucket.example/put', contentType: 'image/png' };

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

function reply(status: number, body: unknown = ''): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { status, text: async () => text } as Response;
}

/** The edge answers `uploadUrl` per file path; every other request succeeds. */
function edge(uploadUrl: (path: string) => Response): void {
  mocks.fetchWithRetries.mockImplementation(async (url: URL) =>
    url.searchParams.get('type') === 'uploadUrl'
      ? uploadUrl(url.searchParams.get('filename') ?? '')
      : reply(200)
  );
}

function requests(): [URL, RequestInit][] {
  return mocks.fetchWithRetries.mock.calls as [URL, RequestInit][];
}

function presigned(): URL[] {
  return requests()
    .map(([url]) => url)
    .filter((url) => url.searchParams.get('type') === 'uploadUrl');
}

function puts(): RequestInit[] {
  return requests()
    .map(([, init]) => init)
    .filter((init) => init.method === 'PUT');
}

function sha256(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

describe('uploadStoredAssets', () => {
  const big = asset('main.bundle', STORE_THRESHOLD_BYTES + 1);
  const small = asset('small.js', 10);
  const html = asset('index.html', STORE_THRESHOLD_BYTES + 1);

  beforeEach(() => {
    mocks.fetchWithRetries.mockReset();
    rs.mocked(gzip).mockClear();
    edge(() => reply(200, PRESIGNED));
  });

  it('stores large assets gzipped, records store, and leaves the rest for EdgeKV', async () => {
    const { snapshot, assetsMap, engine } = setup([big, small, html]);

    const { regularAssets, storedHashes } = await uploadStoredAssets(
      engine,
      snapshot,
      assetsMap,
      [big, small, html]
    );

    expect(regularAssets.map((a) => a.path)).toEqual(['small.js', 'index.html']);
    expect([...storedHashes]).toEqual([big.hash]);
    const store = snapshot.assets['main.bundle']?.store;
    expect(store).toMatchObject({ encoding: 'gzip' });
    expect(snapshot.assets['index.html']?.store).toBeUndefined();

    expect(presigned()[0]?.searchParams.get('hash')).toBe(store?.object);
    const [put] = puts();
    expect(put?.headers).toEqual({
      'Content-Type': PRESIGNED.contentType,
      'Content-Encoding': 'gzip',
    });
    const body = put?.body as Buffer;
    expect(body.length).toBe(store?.size);
    expect(sha256(body)).toBe(store?.object);
    expect(gunzipSync(body).equals(big.buffer as Buffer)).toBe(true);
  });

  it.each([
    [
      'a worker without a bucket (501)',
      501,
      'Object storage is not configured for this worker.',
    ],
    ['a worker released before stored assets', 501, 'Not Implemented'],
  ])(
    'keeps every asset for EdgeKV and gzips only the probe for %s',
    async (_name, status, body) => {
      edge(() => reply(status, body));
      const others = [asset('b.bundle', big.size), asset('c.bundle', big.size)];
      const { snapshot, assetsMap, engine } = setup([big, ...others, small]);

      const { regularAssets, storedHashes } = await uploadStoredAssets(
        engine,
        snapshot,
        assetsMap,
        [big, ...others, small]
      );

      expect(regularAssets).toEqual([big, ...others, small]);
      expect(storedHashes.size).toBe(0);
      expect(Object.values(snapshot.assets).some((a) => a.store)).toBe(false);
      expect(mocks.fetchWithRetries).toHaveBeenCalledTimes(1);
      expect(gzip).toHaveBeenCalledTimes(1);
    }
  );

  it('keeps assets the edge refuses to store (415) for EdgeKV and stores the others', async () => {
    edge((path) =>
      path.endsWith('.xml')
        ? reply(415, 'This file type cannot be stored.')
        : reply(200, PRESIGNED)
    );
    const first = asset('first.xml', big.size);
    const last = asset('last.xml', big.size);
    const { snapshot, assetsMap, engine } = setup([first, big, last]);

    const { regularAssets, storedHashes } = await uploadStoredAssets(
      engine,
      snapshot,
      assetsMap,
      [first, big, last]
    );

    expect(regularAssets).toEqual([first, last]);
    expect([...storedHashes]).toEqual([big.hash]);
    expect(snapshot.assets['first.xml']?.store).toBeUndefined();
    expect(snapshot.assets['last.xml']?.store).toBeUndefined();
    expect(snapshot.assets['main.bundle']?.store).toBeDefined();
    expect(puts()).toHaveLength(1);
  });

  it('stores already-compressed types as they are', async () => {
    const image = asset('photo.png', big.size);
    const { snapshot, assetsMap, engine } = setup([image]);

    await uploadStoredAssets(engine, snapshot, assetsMap, [image]);

    const raw = image.buffer as Buffer;
    expect(snapshot.assets['photo.png']?.store).toEqual({
      object: sha256(raw),
      size: raw.length,
    });
    const [put] = puts();
    expect(put?.headers).toEqual({ 'Content-Type': PRESIGNED.contentType });
    expect(put?.body).toEqual(raw);
    expect(gzip).not.toHaveBeenCalled();
  });

  it('fails the upload and leaves the snapshot untouched when a PUT fails', async () => {
    mocks.fetchWithRetries
      .mockResolvedValueOnce(reply(200, PRESIGNED))
      .mockResolvedValueOnce(reply(400, 'bad signature'));
    const { snapshot, assetsMap, engine } = setup([big]);

    await expect(
      uploadStoredAssets(engine, snapshot, assetsMap, [big])
    ).rejects.toThrow();
    expect(snapshot.assets['main.bundle']?.store).toBeUndefined();
  });

  it('does nothing on other platforms', async () => {
    const { snapshot, assetsMap, engine } = setup([big], 'cloudflare');

    const { regularAssets } = await uploadStoredAssets(engine, snapshot, assetsMap, [
      big,
    ]);

    expect(regularAssets).toEqual([big]);
    expect(mocks.fetchWithRetries).not.toHaveBeenCalled();
  });
});
