import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';

const mocks = rs.hoisted(() => ({
  getApplicationHashList: rs.fn(),
  /** In-memory stand-in for the persistent store, with the same ttl semantics. */
  store: new Map<string, { value: unknown; expiresAt?: number }>(),
}));

rs.mock('../edge-requests/get-application-hash-list', () => ({
  getApplicationHashList: mocks.getApplicationHashList,
}));
rs.mock('./get-cache-key', () => ({
  getCacheKey: async (application_uid: string) => `${application_uid}-edge.example`,
}));
rs.mock('../node-persist/storage', () => ({
  storage: Promise.resolve(),
  getItem: async (key: string) => {
    const datum = mocks.store.get(key);
    if (datum?.expiresAt !== undefined && datum.expiresAt < Date.now()) {
      mocks.store.delete(key);
      return undefined;
    }
    return datum?.value;
  },
  setItem: async (key: string, value: unknown, options: { ttl?: number } = {}) => {
    mocks.store.set(key, {
      value,
      expiresAt: options.ttl ? Date.now() + options.ttl : undefined,
    });
  },
  removeItem: async (key: string) => {
    mocks.store.delete(key);
  },
}));

import { HASH_CACHE_TTL_MS } from '../node-persist/hash-cache';
import { StorageKeys } from '../node-persist/storage-keys';
import {
  get_hash_list,
  remove_hashes_from_hash_list,
  update_hash_list,
} from './distributed-hash-control';

const APP = 'org.project.app';
const HOUR_MS = 60 * 60 * 1000;

function assetsMap(...hashes: string[]): ZeBuildAssetsMap {
  return Object.fromEntries(hashes.map((hash) => [hash, { hash }])) as never;
}

async function cachedHashes(): Promise<string[]> {
  return [...(await get_hash_list(APP)).hash_set].sort();
}

describe('edge hash list cache', () => {
  let now: number;

  beforeEach(() => {
    rs.clearAllMocks();
    mocks.store.clear();
    now = Date.UTC(2026, 9, 1);
    rs.spyOn(Date, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    rs.restoreAllMocks();
  });

  it('expires 24h after the fetch even when hashes are added or removed later', async () => {
    mocks.getApplicationHashList.mockResolvedValueOnce({ hashes: ['a', 'b'] });
    await expect(cachedHashes()).resolves.toEqual(['a', 'b']);

    now += 23 * HOUR_MS;
    await update_hash_list(APP, assetsMap('c'));
    await remove_hashes_from_hash_list(APP, ['a']);
    await expect(cachedHashes()).resolves.toEqual(['b', 'c']);
    expect(mocks.getApplicationHashList).toHaveBeenCalledTimes(1);

    // Only 1h after the last write, but 24h after the fetch.
    now += HOUR_MS;
    mocks.getApplicationHashList.mockResolvedValueOnce({ hashes: ['d'] });
    await expect(cachedHashes()).resolves.toEqual(['d']);
    expect(mocks.getApplicationHashList).toHaveBeenCalledTimes(2);
  });

  it('keeps using the cache before 24h have passed', async () => {
    mocks.getApplicationHashList.mockResolvedValueOnce({ hashes: ['a'] });
    await cachedHashes();

    now += HASH_CACHE_TTL_MS - 1;
    await expect(cachedHashes()).resolves.toEqual(['a']);
    expect(mocks.getApplicationHashList).toHaveBeenCalledTimes(1);
  });

  it('refetches entries written by older agents without a fetch time', async () => {
    mocks.store.set(`${StorageKeys.ze_hash_cache}:${APP}-edge.example`, {
      value: { hashes: ['stale'] },
      expiresAt: now + HOUR_MS,
    });
    mocks.getApplicationHashList.mockResolvedValueOnce({ hashes: ['fresh'] });

    await expect(cachedHashes()).resolves.toEqual(['fresh']);
    expect(mocks.getApplicationHashList).toHaveBeenCalledTimes(1);
  });

  it('does not start a cache from uploaded hashes alone', async () => {
    await update_hash_list(APP, assetsMap('a'));

    mocks.getApplicationHashList.mockResolvedValueOnce({ hashes: ['b'] });
    await expect(cachedHashes()).resolves.toEqual(['b']);
    expect(mocks.getApplicationHashList).toHaveBeenCalledTimes(1);
  });
});
