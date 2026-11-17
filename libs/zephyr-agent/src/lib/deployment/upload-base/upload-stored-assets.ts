import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import {
  forEachLimit,
  type Snapshot,
  type SnapshotAsset,
  type SnapshotAssetStore,
  type ZeBuildAsset,
  type ZeBuildAssetsMap,
} from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../../zephyr-engine';
import { ZeErrors, ZephyrError } from '../../errors';
import { makeRequest } from '../../http/http-request';
import { ze_log } from '../../logging';
import type { ZeApplicationConfig } from '../../node-persist/upload-provider-options';

/**
 * Raw size above which an asset goes to the Akamai bucket instead of EdgeKV. EdgeKV holds
 * at most 999,999 bytes per value; staying well below keeps the worker's reads small
 * too.
 */
export const STORE_THRESHOLD_BYTES = 500_000;
const UPLOAD_CONCURRENCY = 3;
const NOT_IMPLEMENTED = 501;

interface StoredObject {
  asset: SnapshotAsset;
  store: SnapshotAssetStore;
  bytes: Buffer;
}

interface UploadUrl {
  url: string;
  contentType: string;
}

/**
 * HTML and the manifest must stay readable by the worker; `.gz` files are already
 * compressed.
 */
function isStorable(asset: SnapshotAsset): boolean {
  const path = asset.path.toLowerCase();
  return (
    asset.size > STORE_THRESHOLD_BYTES &&
    !path.endsWith('.html') &&
    !path.endsWith('.htm') &&
    !path.endsWith('zephyr-manifest.json') &&
    !path.endsWith('.gz')
  );
}

function prepare(asset: SnapshotAsset, buffer: Buffer): StoredObject {
  const bytes = gzipSync(buffer, { level: 9 });
  const object = createHash('sha256').update(bytes).digest('hex');
  return { asset, bytes, store: { object, size: bytes.length, encoding: 'gzip' } };
}

function isNotImplemented(cause: unknown): boolean {
  return cause instanceof ZephyrError && cause.data?.['status'] === NOT_IMPLEMENTED;
}

/** `POST /upload?type=uploadUrl`. Resolves `null` when the worker has no bucket (501). */
async function requestUploadUrl(
  { asset, store }: StoredObject,
  { EDGE_URL, jwt }: ZeApplicationConfig
): Promise<UploadUrl | null> {
  const [ok, cause, data] = await makeRequest<UploadUrl>(
    {
      path: '/upload',
      base: EDGE_URL,
      query: { type: 'uploadUrl', hash: store.object, filename: asset.path },
    },
    { method: 'POST', headers: { 'x-file-path': asset.path, can_write_jwt: jwt } }
  );
  if (ok) return data;
  if (isNotImplemented(cause)) return null;
  throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, { type: 'file', cause });
}

/** PUTs the gzip bytes; the edge serves them back with this Content-Type and encoding. */
async function putObject(
  { asset, bytes }: StoredObject,
  { url, contentType }: UploadUrl
): Promise<void> {
  const start = Date.now();
  const [ok, cause] = await makeRequest(
    url,
    {
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'Content-Encoding': 'gzip' },
    },
    bytes
  );
  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, { type: 'file', cause });
  }
  ze_log.upload(
    `stored ${asset.path} (${bytes.length}B gzip) in ${Date.now() - start}ms`
  );
}

async function uploadObject(
  object: StoredObject,
  appConfig: ZeApplicationConfig
): Promise<void> {
  const uploadUrl = await requestUploadUrl(object, appConfig);
  if (!uploadUrl) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'file',
      cause: new Error('The worker stopped accepting stored assets during the upload'),
    });
  }
  await putObject(object, uploadUrl);
}

/**
 * Akamai: stores assets above {@link STORE_THRESHOLD_BYTES} gzipped in the worker's
 * Object Storage bucket, records `store` on their snapshot entries and returns the assets
 * left for the regular upload. Resolves only after every object is stored, so the
 * snapshot never points at a missing object. Other platforms, and Akamai workers without
 * a bucket (501), get `missingAssets` back unchanged.
 */
export async function uploadStoredAssets(
  zephyr_engine: ZephyrEngine,
  snapshot: Snapshot,
  assetsMap: ZeBuildAssetsMap,
  missingAssets: ZeBuildAsset[]
): Promise<ZeBuildAsset[]> {
  const appConfig = await zephyr_engine.application_configuration;
  if (appConfig.PLATFORM !== 'akamai') return missingAssets;

  const objects = Object.values(snapshot.assets).flatMap((asset) => {
    const buffer = assetsMap[asset.hash]?.buffer;
    return buffer && isStorable(asset) ? [prepare(asset, Buffer.from(buffer))] : [];
  });
  const [first, ...rest] = objects;
  if (!first) return missingAssets;

  const firstUrl = await requestUploadUrl(first, appConfig);
  if (!firstUrl) {
    ze_log.upload(
      'Akamai worker has no Object Storage bucket (501); uploading large assets to EdgeKV'
    );
    return missingAssets;
  }
  await putObject(first, firstUrl);
  await forEachLimit<void>(
    rest.map((object) => () => uploadObject(object, appConfig)),
    UPLOAD_CONCURRENCY
  );

  for (const { asset, store } of objects) asset.store = store;
  const stored = new Set(objects.map(({ asset }) => asset.hash));
  return missingAssets.filter((asset) => !stored.has(asset.hash));
}
