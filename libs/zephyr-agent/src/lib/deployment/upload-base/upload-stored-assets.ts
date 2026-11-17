import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
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
import { getHttpErrorStatus, isNotImplementedError } from '../../http/http-failure';
import { makeRequest } from '../../http/http-request';
import { ze_log } from '../../logging';
import type { ZeApplicationConfig } from '../../node-persist/upload-provider-options';

/**
 * Raw size above which an asset goes to the Akamai bucket instead of EdgeKV. EdgeKV holds
 * at most 999,999 bytes per value, and the worker stores binary files as latin1 text, so
 * every byte >= 0x80 takes two bytes there: a 500 KB binary file can already exceed the
 * limit.
 */
export const STORE_THRESHOLD_BYTES = 500_000;
const UPLOAD_CONCURRENCY = 3;
const UNSUPPORTED_MEDIA_TYPE = 415;

/**
 * Already-compressed formats: gzip would not shrink them, so they are stored as they are
 * and served without `Content-Encoding`.
 */
const INCOMPRESSIBLE_EXTENSIONS: Record<string, true> = {
  // images
  '.png': true,
  '.jpg': true,
  '.jpeg': true,
  '.gif': true,
  '.webp': true,
  '.avif': true,
  '.ico': true,
  // fonts
  '.woff': true,
  '.woff2': true,
  // audio and video
  '.mp4': true,
  '.webm': true,
  '.mp3': true,
  '.ogg': true,
  '.wav': true,
  '.mov': true,
  '.m4a': true,
  '.m4v': true,
  // archives and other compressed containers
  '.zip': true,
  '.gz': true,
  '.br': true,
  '.zst': true,
  '.7z': true,
  '.rar': true,
  '.jar': true,
  '.apk': true,
  '.aab': true,
  '.ipa': true,
  '.pdf': true,
};

/** The edge has no Object Storage bucket, or predates stored assets (501). */
const NO_BUCKET = 'no-bucket';
/** The edge refuses to store this file type (415); it keeps the regular upload. */
const NOT_STORABLE = 'not-storable';

const gzipAsync = promisify(gzip);

interface Candidate {
  asset: SnapshotAsset;
  buffer: Buffer;
}

interface StoredObject {
  asset: SnapshotAsset;
  store: SnapshotAssetStore;
  bytes: Buffer;
}

interface UploadUrl {
  url: string;
  contentType: string;
}

interface BucketProbe {
  /** The object stored while probing, if the edge took one. */
  first?: StoredObject;
  /** Index of the first candidate the probe did not try. */
  next: number;
}

export interface StoredAssetsResult {
  /** Missing assets left for the regular upload. */
  regularAssets: ZeBuildAsset[];
  /** Hashes whose bytes live only in the bucket, not in the edge's own storage. */
  storedHashes: ReadonlySet<string>;
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

function isCompressible(asset: SnapshotAsset): boolean {
  return INCOMPRESSIBLE_EXTENSIONS[extname(asset.path).toLowerCase()] !== true;
}

async function prepare({ asset, buffer }: Candidate): Promise<StoredObject> {
  const encoding = isCompressible(asset) ? 'gzip' : undefined;
  const bytes = encoding ? await gzipAsync(buffer, { level: 9 }) : buffer;
  const object = createHash('sha256').update(bytes).digest('hex');
  const store: SnapshotAssetStore = { object, size: bytes.length };
  if (encoding) store.encoding = encoding;
  return { asset, bytes, store };
}

/** `POST /upload?type=uploadUrl`: a presigned PUT, or why this object cannot be stored. */
async function requestUploadUrl(
  { asset, store }: StoredObject,
  { EDGE_URL, jwt }: ZeApplicationConfig
): Promise<UploadUrl | typeof NO_BUCKET | typeof NOT_STORABLE> {
  const [ok, cause, data] = await makeRequest<UploadUrl>(
    {
      path: '/upload',
      base: EDGE_URL,
      query: { type: 'uploadUrl', hash: store.object, filename: asset.path },
    },
    { method: 'POST', headers: { 'x-file-path': asset.path, can_write_jwt: jwt } }
  );
  if (ok) return data;
  if (isNotImplementedError(cause)) return NO_BUCKET;
  if (getHttpErrorStatus(cause) === UNSUPPORTED_MEDIA_TYPE) return NOT_STORABLE;
  throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, { type: 'file', cause });
}

/**
 * PUTs the stored bytes. `Content-Type` is signed and must match the presigned one;
 * `Content-Encoding` is sent only for gzip bytes.
 */
async function putObject(
  { asset, bytes, store }: StoredObject,
  { url, contentType }: UploadUrl
): Promise<void> {
  const start = Date.now();
  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (store.encoding) headers['Content-Encoding'] = store.encoding;
  const [ok, cause] = await makeRequest(url, { method: 'PUT', headers }, bytes);
  if (!ok) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, { type: 'file', cause });
  }
  ze_log.upload(
    `stored ${asset.path} (${bytes.length}B ${store.encoding ?? 'raw'}) in ${Date.now() - start}ms`
  );
}

/** Stores one asset once the edge is known to have a bucket. */
async function storeCandidate(
  candidate: Candidate,
  appConfig: ZeApplicationConfig
): Promise<StoredObject | undefined> {
  const object = await prepare(candidate);
  const uploadUrl = await requestUploadUrl(object, appConfig);
  if (uploadUrl === NOT_STORABLE) return undefined;
  if (uploadUrl === NO_BUCKET) {
    throw new ZephyrError(ZeErrors.ERR_FAILED_UPLOAD, {
      type: 'file',
      cause: new Error('The worker stopped accepting stored assets during the upload'),
    });
  }
  await putObject(object, uploadUrl);
  return object;
}

/**
 * Asks for upload URLs one asset at a time until the edge takes one (stores it) or
 * answers it has no bucket (resolves `undefined`). A 415 only rules out that asset.
 */
async function probeBucket(
  candidates: Candidate[],
  appConfig: ZeApplicationConfig
): Promise<BucketProbe | undefined> {
  for (const [index, candidate] of candidates.entries()) {
    const object = await prepare(candidate);
    const uploadUrl = await requestUploadUrl(object, appConfig);
    if (uploadUrl === NO_BUCKET) return undefined;
    if (uploadUrl === NOT_STORABLE) continue;
    await putObject(object, uploadUrl);
    return { first: object, next: index + 1 };
  }
  return { next: candidates.length };
}

/** Hashes of stored assets that no other, unstored snapshot entry still needs. */
function bucketOnlyHashes(snapshot: Snapshot, stored: StoredObject[]): Set<string> {
  const unstored = new Set(
    Object.values(snapshot.assets)
      .filter((asset) => !asset.store)
      .map((asset) => asset.hash)
  );
  return new Set(
    stored.map(({ asset }) => asset.hash).filter((hash) => !unstored.has(hash))
  );
}

/**
 * Akamai: stores assets above {@link STORE_THRESHOLD_BYTES} in the worker's Object
 * Storage bucket (gzipped unless already compressed), records `store` on their snapshot
 * entries and returns the assets left for the regular upload. Resolves only after every
 * object is stored, so the snapshot never points at a missing object. Other platforms,
 * and Akamai workers without a bucket (501), get `missingAssets` back unchanged.
 */
export async function uploadStoredAssets(
  zephyr_engine: ZephyrEngine,
  snapshot: Snapshot,
  assetsMap: ZeBuildAssetsMap,
  missingAssets: ZeBuildAsset[]
): Promise<StoredAssetsResult> {
  const unchanged = { regularAssets: missingAssets, storedHashes: new Set<string>() };
  const appConfig = await zephyr_engine.application_configuration;
  if (appConfig.PLATFORM !== 'akamai') return unchanged;

  const candidates = Object.values(snapshot.assets).flatMap((asset) => {
    const buffer = assetsMap[asset.hash]?.buffer;
    if (!buffer || !isStorable(asset)) return [];
    return [{ asset, buffer: Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer) }];
  });
  // Probe with assets that need no gzip first: an edge without a bucket then costs none.
  candidates.sort(
    (left, right) =>
      Number(isCompressible(left.asset)) - Number(isCompressible(right.asset))
  );

  const probe = await probeBucket(candidates, appConfig);
  if (!probe) {
    ze_log.upload(
      'Akamai worker has no Object Storage bucket (501); uploading large assets to EdgeKV'
    );
    return unchanged;
  }
  const rest = await forEachLimit(
    candidates
      .slice(probe.next)
      .map((candidate) => () => storeCandidate(candidate, appConfig)),
    UPLOAD_CONCURRENCY
  );
  const stored = [probe.first, ...rest].filter((object) => object !== undefined);

  for (const { asset, store } of stored) asset.store = store;
  const storedHashes = bucketOnlyHashes(snapshot, stored);
  return {
    regularAssets: missingAssets.filter((asset) => !storedHashes.has(asset.hash)),
    storedHashes,
  };
}
