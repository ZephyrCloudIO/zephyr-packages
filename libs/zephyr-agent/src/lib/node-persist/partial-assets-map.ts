import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rm } from 'node:fs/promises';
import * as path from 'node:path';
import { lock } from 'proper-lockfile';
import type { ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { zeBuildAssets } from '../transformers/ze-build-assets';
import { writeFileAtomically } from './atomic-file';
import { storage } from './storage';
import {
  ensurePrivateFilePermissions,
  PARTIAL_ASSET_LOCK_STALE_MS,
  StorageKeys,
  ZE_LOCKS_PATH,
  ZE_PATH,
  ZE_STORAGE_PATH,
} from './storage-keys';

export interface PartialAssetMaps {
  [partialKey: string]: ZeBuildAssetsMap;
}

/** Identifies one logical producer/finalizer invocation and its rebuild generation. */
export interface PartialAssetMapScope {
  invocationId: string;
  generation: number;
}

/** An immutable persisted snapshot. Commit or roll it back after publication. */
export interface PartialAssetMapClaim {
  claimId: string;
  scope: PartialAssetMapScope;
  partialAssetMaps: PartialAssetMaps;
}

/** An all-or-nothing set of claims acquired under one application store lock. */
export interface PartialAssetMapClaimBatch {
  claims: readonly PartialAssetMapClaim[];
}

const BUFFER_ENCODING_KEY = '__zephyr_buffer_base64__';
const STORE_VERSION_KEY = '__zephyr_partial_store_version__';
const STORE_VERSION = 2;
const CLAIM_STALE_MS = 30 * 60 * 1000;
const GROUP_STALE_MS = 24 * 60 * 60 * 1000;
const LEGACY_SCOPE: PartialAssetMapScope = {
  invocationId: '__zephyr_legacy_unscoped__',
  generation: 0,
};

interface PersistedBuffer {
  [BUFFER_ENCODING_KEY]: string;
}

interface LegacyJsonBuffer {
  type: 'Buffer';
  data: number[];
}

type PersistedAsset = Omit<ZeBuildAsset, 'buffer'> & {
  buffer: string | PersistedBuffer | LegacyJsonBuffer;
};

type PersistedPartialAssetMaps = Record<string, Record<string, PersistedAsset>>;

interface PersistedPartialEntry {
  revision: number;
  assets: Record<string, PersistedAsset>;
}

interface PersistedPartialGroup {
  scope: PartialAssetMapScope;
  entries: Record<string, PersistedPartialEntry>;
  updatedAt: number;
}

interface PersistedPartialClaim {
  scopeKey: string;
  revisions: Record<string, number>;
  createdAt: number;
}

interface PersistedPartialStore {
  [STORE_VERSION_KEY]: typeof STORE_VERSION;
  nextRevision: number;
  groups: Record<string, PersistedPartialGroup>;
  claims: Record<string, PersistedPartialClaim>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodeBuffer(value: unknown): Buffer | string {
  if (Buffer.isBuffer(value) || typeof value === 'string') {
    return value;
  }
  if (isRecord(value) && typeof value[BUFFER_ENCODING_KEY] === 'string') {
    return Buffer.from(value[BUFFER_ENCODING_KEY], 'base64');
  }
  if (
    isRecord(value) &&
    value['type'] === 'Buffer' &&
    Array.isArray(value['data']) &&
    value['data'].every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)
  ) {
    return Buffer.from(value['data'] as number[]);
  }
  throw new TypeError('Persisted partial asset contains an invalid buffer');
}

/** @internal Exported for persistence compatibility tests. */
export function serializePartialAssetMaps(
  partialAssetMaps: PartialAssetMaps
): PersistedPartialAssetMaps {
  return Object.fromEntries(
    Object.entries(partialAssetMaps).map(([partialKey, assetsMap]) => [
      partialKey,
      Object.fromEntries(
        Object.entries(assetsMap).map(([hash, asset]) => [
          hash,
          {
            ...asset,
            buffer: Buffer.isBuffer(asset.buffer)
              ? { [BUFFER_ENCODING_KEY]: asset.buffer.toString('base64') }
              : asset.buffer,
          },
        ])
      ),
    ])
  );
}

/** @internal Exported for persistence compatibility tests. */
export function deserializePartialAssetMaps(
  value: unknown
): PartialAssetMaps | undefined {
  if (value === undefined || value === null) return undefined;
  if (!isRecord(value)) {
    throw new TypeError('Persisted partial asset maps must be an object');
  }

  return Object.fromEntries(
    Object.entries(value).map(([partialKey, rawAssetsMap]) => {
      if (!isRecord(rawAssetsMap)) {
        throw new TypeError(`Persisted partial "${partialKey}" must be an object`);
      }
      return [
        partialKey,
        Object.fromEntries(
          Object.entries(rawAssetsMap).map(([hash, rawAsset]) => {
            if (!isRecord(rawAsset)) {
              throw new TypeError(
                `Persisted partial asset "${partialKey}:${hash}" must be an object`
              );
            }
            const assetPath = rawAsset['path'];
            if (typeof assetPath !== 'string') {
              throw new TypeError(
                `Persisted partial asset "${partialKey}:${hash}" has no valid path`
              );
            }
            const slashPath = assetPath.replace(/\\/g, '/');
            const pathSegments = slashPath
              .split('/')
              .filter((segment) => segment && segment !== '.');
            if (
              !slashPath ||
              slashPath.includes('\0') ||
              slashPath.startsWith('/') ||
              /^[A-Za-z]:/.test(slashPath) ||
              pathSegments.length === 0 ||
              pathSegments.includes('..')
            ) {
              throw new TypeError(
                `Persisted partial asset "${partialKey}:${hash}" escapes the snapshot root`
              );
            }
            const buffer = decodeBuffer(rawAsset['buffer']);
            const rebuilt = zeBuildAssets({ filepath: assetPath, content: buffer });
            if (
              rawAsset['hash'] !== hash ||
              rebuilt.hash !== hash ||
              rawAsset['size'] !== rebuilt.size
            ) {
              throw new TypeError(
                `Persisted partial asset "${partialKey}:${hash}" failed its content integrity check`
              );
            }
            const normalizedPath = pathSegments.join('/');
            const normalizedAsset =
              normalizedPath === assetPath
                ? rebuilt
                : zeBuildAssets({ filepath: normalizedPath, content: buffer });
            return [
              normalizedAsset.hash,
              {
                ...(rawAsset as Omit<ZeBuildAsset, 'buffer'>),
                path: normalizedAsset.path,
                hash: normalizedAsset.hash,
                size: normalizedAsset.size,
                extname: normalizedAsset.extname,
                buffer,
              },
            ];
          })
        ),
      ];
    })
  );
}

function assertScope(scope: PartialAssetMapScope): void {
  if (!scope.invocationId.trim()) {
    throw new TypeError('Partial asset invocationId must not be empty');
  }
  if (!Number.isSafeInteger(scope.generation) || scope.generation < 0) {
    throw new TypeError('Partial asset generation must be a non-negative safe integer');
  }
}

function getScopeKey(scope: PartialAssetMapScope): string {
  assertScope(scope);
  return JSON.stringify([scope.invocationId, scope.generation]);
}

function emptyStore(): PersistedPartialStore {
  return {
    [STORE_VERSION_KEY]: STORE_VERSION,
    nextRevision: 1,
    groups: {},
    claims: {},
  };
}

function parseScope(value: unknown): PartialAssetMapScope {
  if (
    !isRecord(value) ||
    typeof value['invocationId'] !== 'string' ||
    typeof value['generation'] !== 'number'
  ) {
    throw new TypeError('Persisted partial group has an invalid scope');
  }
  const scope = {
    invocationId: value['invocationId'],
    generation: value['generation'],
  };
  assertScope(scope);
  return scope;
}

function readStore(value: unknown): PersistedPartialStore {
  if (value === undefined || value === null) return emptyStore();

  if (isRecord(value) && value[STORE_VERSION_KEY] === STORE_VERSION) {
    if (
      !Number.isSafeInteger(value['nextRevision']) ||
      (value['nextRevision'] as number) < 1 ||
      !isRecord(value['groups']) ||
      !isRecord(value['claims'])
    ) {
      throw new TypeError('Persisted partial asset store is malformed');
    }
    const store = value as unknown as PersistedPartialStore;
    for (const [scopeKey, group] of Object.entries(store.groups)) {
      if (
        !isRecord(group) ||
        !isRecord(group.entries) ||
        typeof group.updatedAt !== 'number'
      ) {
        throw new TypeError(`Persisted partial group "${scopeKey}" is malformed`);
      }
      const scope = parseScope(group.scope);
      if (getScopeKey(scope) !== scopeKey) {
        throw new TypeError(
          `Persisted partial group "${scopeKey}" has a mismatched scope`
        );
      }
      for (const [partialKey, entry] of Object.entries(group.entries)) {
        if (
          !isRecord(entry) ||
          !Number.isSafeInteger(entry.revision) ||
          entry.revision < 1 ||
          !isRecord(entry.assets)
        ) {
          throw new TypeError(
            `Persisted partial contribution "${scopeKey}:${partialKey}" is malformed`
          );
        }
        deserializePartialAssetMaps({ [partialKey]: entry.assets });
      }
    }
    for (const [claimId, claim] of Object.entries(store.claims)) {
      if (
        !isRecord(claim) ||
        typeof claim.scopeKey !== 'string' ||
        !isRecord(claim.revisions) ||
        typeof claim.createdAt !== 'number' ||
        !Object.values(claim.revisions).every(
          (revision) => Number.isSafeInteger(revision) && revision >= 1
        )
      ) {
        throw new TypeError(`Persisted partial claim "${claimId}" is malformed`);
      }
    }
    return store;
  }

  // Earlier releases stored one unscoped map. Keep it in an isolated legacy group;
  // scoped Vite builds never consume this bucket, so it cannot mix with new invocations.
  const legacyMaps = deserializePartialAssetMaps(value);
  const store = emptyStore();
  if (legacyMaps && Object.keys(legacyMaps).length > 0) {
    const scopeKey = getScopeKey(LEGACY_SCOPE);
    store.groups[scopeKey] = {
      scope: { ...LEGACY_SCOPE },
      entries: {},
      updatedAt: Date.now(),
    };
    for (const [partialKey, assetsMap] of Object.entries(legacyMaps)) {
      store.groups[scopeKey].entries[partialKey] = {
        revision: store.nextRevision++,
        assets: serializePartialAssetMaps({ [partialKey]: assetsMap })[partialKey],
      };
    }
  }
  return store;
}

function readVersionedStore(value: unknown): PersistedPartialStore {
  if (!isRecord(value) || value[STORE_VERSION_KEY] !== STORE_VERSION) {
    throw new TypeError('Persisted partial asset store has an unsupported schema');
  }
  return readStore(value);
}

function pruneStaleStore(store: PersistedPartialStore, now = Date.now()): void {
  for (const [claimId, claim] of Object.entries(store.claims)) {
    if (now - claim.createdAt >= CLAIM_STALE_MS) {
      delete store.claims[claimId];
    }
  }
  const claimedScopes = new Set(
    Object.values(store.claims).map((claim) => claim.scopeKey)
  );
  for (const [scopeKey, group] of Object.entries(store.groups)) {
    if (!claimedScopes.has(scopeKey) && now - group.updatedAt >= GROUP_STALE_MS) {
      delete store.groups[scopeKey];
    }
  }
}

function deserializeGroup(group: PersistedPartialGroup): PartialAssetMaps {
  return Object.fromEntries(
    Object.entries(group.entries).map(([partialKey, entry]) => {
      const assetsMap = deserializePartialAssetMaps({ [partialKey]: entry.assets });
      return [partialKey, assetsMap?.[partialKey] ?? {}];
    })
  );
}

function get_key(application_uid: string): string {
  return [StorageKeys.ze_app_partial_asset_map, application_uid].join('.');
}

function get_application_digest(application_uid: string): string {
  return createHash('sha256').update(application_uid).digest('hex');
}

/** @internal Exposed for persistence fault-injection tests. */
export function getPartialAssetStorePath(application_uid: string): string {
  return path.join(
    ZE_PATH,
    'partial-assets',
    `${get_application_digest(application_uid)}.json`
  );
}

/** @internal Location used by node-persist releases before the atomic store. */
export function getLegacyPartialAssetStorePath(application_uid: string): string {
  const legacyKeyDigest = createHash('sha256')
    .update(get_key(application_uid))
    .digest('hex');
  return path.join(ZE_STORAGE_PATH, legacyKeyDigest);
}

/** @internal Exposed for persistence-boundary compatibility tests. */
export function getPartialAssetLockPath(application_uid: string): string {
  return path.join(
    ZE_LOCKS_PATH,
    `partial-assets-${get_application_digest(application_uid)}`
  );
}

async function withPartialAssetsLock<T>(
  application_uid: string,
  action: () => Promise<T>
): Promise<T> {
  await storage;
  // Recreate the private boundary if an external cleanup removed it while this process
  // was alive. Persistent lock targets are intentional: proper-lockfile coordinates
  // restarts through a stable path and keeps its transient ownership in `.lock`.
  await mkdir(ZE_LOCKS_PATH, { recursive: true, mode: 0o700 });
  const lockPath = getPartialAssetLockPath(application_uid);
  await (await open(lockPath, 'a', 0o600)).close();
  ensurePrivateFilePermissions(lockPath);
  const release = await lock(lockPath, {
    realpath: false,
    retries: { retries: 8, factor: 1.5, minTimeout: 25, maxTimeout: 500 },
    stale: PARTIAL_ASSET_LOCK_STALE_MS,
  });

  try {
    return await action();
  } finally {
    await release();
  }
}

async function readJsonFileStrict(filePath: string): Promise<unknown | undefined> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }

  try {
    return JSON.parse(content) as unknown;
  } catch (error: unknown) {
    throw Object.assign(
      new TypeError(`Partial asset store "${filePath}" contains invalid JSON`),
      { cause: error }
    );
  }
}

async function readLegacyStoreValue(
  application_uid: string
): Promise<{ found: boolean; value?: unknown }> {
  const legacyPath = getLegacyPartialAssetStorePath(application_uid);
  const datum = await readJsonFileStrict(legacyPath);
  if (datum === undefined) return { found: false };
  if (!isRecord(datum) || datum['key'] !== get_key(application_uid)) {
    throw new TypeError(`Legacy partial asset store "${legacyPath}" is malformed`);
  }
  if (
    typeof datum['ttl'] === 'number' &&
    Number.isFinite(datum['ttl']) &&
    datum['ttl'] < Date.now()
  ) {
    await rm(legacyPath, { force: true });
    return { found: false };
  }
  if (!Object.prototype.hasOwnProperty.call(datum, 'value')) {
    throw new TypeError(`Legacy partial asset store "${legacyPath}" has no value`);
  }
  return { found: true, value: datum['value'] };
}

async function writeStore(
  application_uid: string,
  store: PersistedPartialStore
): Promise<void> {
  await writeFileAtomically(
    getPartialAssetStorePath(application_uid),
    JSON.stringify(store)
  );
}

async function readApplicationStore(
  application_uid: string
): Promise<PersistedPartialStore> {
  const storePath = getPartialAssetStorePath(application_uid);
  const persisted = await readJsonFileStrict(storePath);
  if (persisted !== undefined) {
    return readVersionedStore(persisted);
  }

  const legacy = await readLegacyStoreValue(application_uid);
  if (!legacy.found) return emptyStore();
  const migrated = readStore(legacy.value);
  // Commit the replacement before removing the legacy file. A crash at any point
  // therefore leaves at least one complete source of truth for the next process.
  await writeStore(application_uid, migrated);
  await rm(getLegacyPartialAssetStorePath(application_uid), { force: true });
  return migrated;
}

export async function savePartialAssetMap(
  application_uid: string,
  partial_key: string,
  assetMap: ZeBuildAssetsMap,
  scope: PartialAssetMapScope = LEGACY_SCOPE
): Promise<void> {
  assertScope(scope);
  await withPartialAssetsLock(application_uid, async () => {
    const store = await readApplicationStore(application_uid);
    pruneStaleStore(store);
    const scopeKey = getScopeKey(scope);
    const group = (store.groups[scopeKey] ??= {
      scope: { ...scope },
      entries: {},
      updatedAt: Date.now(),
    });
    group.updatedAt = Date.now();
    group.entries[partial_key] = {
      revision: store.nextRevision++,
      assets: serializePartialAssetMaps({ [partial_key]: assetMap })[partial_key],
    };
    await writeStore(application_uid, store);
  });
}

export async function getPartialAssetMap(
  application_uid: string,
  scope: PartialAssetMapScope = LEGACY_SCOPE
): Promise<PartialAssetMaps | undefined> {
  assertScope(scope);
  return withPartialAssetsLock(application_uid, async () => {
    const store = await readApplicationStore(application_uid);
    const group = store.groups[getScopeKey(scope)];
    return group ? deserializeGroup(group) : undefined;
  });
}

/** Atomically claim every requested scope, or none when any scope is unavailable. */
export async function claimPartialAssetMapBatch(
  application_uid: string,
  scopes: readonly PartialAssetMapScope[]
): Promise<PartialAssetMapClaimBatch | undefined> {
  if (scopes.length === 0) {
    throw new TypeError('At least one partial asset scope must be claimed');
  }
  const scopeKeys = scopes.map((scope) => {
    assertScope(scope);
    return getScopeKey(scope);
  });
  if (new Set(scopeKeys).size !== scopeKeys.length) {
    throw new TypeError('Partial asset scopes must be unique within a claim batch');
  }

  return withPartialAssetsLock(application_uid, async () => {
    const store = await readApplicationStore(application_uid);
    pruneStaleStore(store);
    const candidates = scopes.map((scope, index) => {
      const scopeKey = scopeKeys[index];
      const group = store.groups[scopeKey];
      if (!group || Object.keys(group.entries).length === 0) return undefined;
      const revisions = Object.fromEntries(
        Object.entries(group.entries).map(([partialKey, entry]) => [
          partialKey,
          entry.revision,
        ])
      );
      const isAlreadyClaimed = Object.values(store.claims).some(
        (claim) =>
          claim.scopeKey === scopeKey &&
          Object.entries(revisions).some(
            ([partialKey, revision]) => claim.revisions[partialKey] === revision
          )
      );
      return isAlreadyClaimed ? undefined : { scope, scopeKey, group, revisions };
    });
    if (candidates.some((candidate) => !candidate)) return undefined;

    const now = Date.now();
    const claims = candidates.map((candidate) => {
      if (!candidate) throw new TypeError('Partial claim candidate was unavailable');
      const claimId = randomUUID();
      store.claims[claimId] = {
        scopeKey: candidate.scopeKey,
        revisions: candidate.revisions,
        createdAt: now,
      };
      return {
        claimId,
        scope: { ...candidate.scope },
        partialAssetMaps: deserializeGroup(candidate.group),
      } satisfies PartialAssetMapClaim;
    });
    await writeStore(application_uid, store);
    return { claims: Object.freeze(claims) };
  });
}

/** Atomically mark one invocation/generation snapshot as claimed without deleting it. */
export async function claimPartialAssetMap(
  application_uid: string,
  scope: PartialAssetMapScope
): Promise<PartialAssetMapClaim | undefined> {
  const batch = await claimPartialAssetMapBatch(application_uid, [scope]);
  return batch?.claims[0];
}

/** Delete only the exact revisions published by a claim; newer writes always survive. */
export async function commitPartialAssetMapClaimBatch(
  application_uid: string,
  claimIds: readonly string[]
): Promise<void> {
  const uniqueClaimIds = [...new Set(claimIds)];
  if (uniqueClaimIds.length === 0) return;
  await withPartialAssetsLock(application_uid, async () => {
    const store = await readApplicationStore(application_uid);
    let changed = false;
    for (const claimId of uniqueClaimIds) {
      const claim = store.claims[claimId];
      if (!claim) continue;
      const group = store.groups[claim.scopeKey];
      if (group) {
        for (const [partialKey, revision] of Object.entries(claim.revisions)) {
          if (group.entries[partialKey]?.revision === revision) {
            delete group.entries[partialKey];
          }
        }
        if (Object.keys(group.entries).length === 0) {
          delete store.groups[claim.scopeKey];
        }
      }
      delete store.claims[claimId];
      changed = true;
    }
    if (changed) await writeStore(application_uid, store);
  });
}

export async function commitPartialAssetMapClaim(
  application_uid: string,
  claimId: string
): Promise<void> {
  await commitPartialAssetMapClaimBatch(application_uid, [claimId]);
}

/** Release a claim. Contributions were never removed, so rollback cannot overwrite. */
export async function rollbackPartialAssetMapClaimBatch(
  application_uid: string,
  claimIds: readonly string[]
): Promise<void> {
  const uniqueClaimIds = [...new Set(claimIds)];
  if (uniqueClaimIds.length === 0) return;
  await withPartialAssetsLock(application_uid, async () => {
    const store = await readApplicationStore(application_uid);
    let changed = false;
    for (const claimId of uniqueClaimIds) {
      if (!store.claims[claimId]) continue;
      delete store.claims[claimId];
      changed = true;
    }
    if (changed) await writeStore(application_uid, store);
  });
}

export async function rollbackPartialAssetMapClaim(
  application_uid: string,
  claimId: string
): Promise<void> {
  await rollbackPartialAssetMapClaimBatch(application_uid, [claimId]);
}

/** Legacy destructive API, isolated to the legacy bucket for compatibility. */
export async function takePartialAssetMap(
  application_uid: string
): Promise<PartialAssetMaps | undefined> {
  const claim = await claimPartialAssetMap(application_uid, LEGACY_SCOPE);
  if (!claim) return undefined;
  await commitPartialAssetMapClaim(application_uid, claim.claimId);
  return claim.partialAssetMaps;
}

export async function removePartialAssetMap(application_uid: string): Promise<void> {
  await withPartialAssetsLock(application_uid, async () => {
    // Remove the legacy source first so an interrupted cleanup can never resurrect it
    // after the atomic store has been removed.
    await rm(getLegacyPartialAssetStorePath(application_uid), { force: true });
    await rm(getPartialAssetStorePath(application_uid), { force: true });
  });
}
