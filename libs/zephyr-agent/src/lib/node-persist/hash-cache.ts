import { getItem, removeItem, setItem, storage } from './storage';
import { StorageKeys } from './storage-keys';

/** How long a hash list is trusted, counted from when it was fetched from the edge. */
export const HASH_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

export interface AppHashCache {
  hashes: string[];
  /**
   * When the list was fetched from the edge (epoch ms). Updates keep it, so the entry
   * expires 24h after the fetch no matter how often it is rewritten.
   */
  fetched_at: number;
}

export async function setAppHashCache(
  application_uid: string,
  value: AppHashCache
): Promise<void> {
  const ttl = value.fetched_at + HASH_CACHE_TTL_MS - Date.now();
  if (ttl <= 0) {
    return;
  }
  await storage;
  await setItem(`${StorageKeys.ze_hash_cache}:${application_uid}`, value, { ttl });
}

/** Returns the cached hash list, or `undefined` once it is 24h past its fetch. */
export async function getAppHashCache(
  application_uid: string
): Promise<AppHashCache | undefined> {
  await storage;
  const cache = await getItem<Partial<AppHashCache>>(
    `${StorageKeys.ze_hash_cache}:${application_uid}`
  );
  // Entries written by older agents have no fetch time and may have outlived 24h.
  if (!Array.isArray(cache?.hashes) || typeof cache.fetched_at !== 'number') {
    return undefined;
  }
  const age = Date.now() - cache.fetched_at;
  return age >= 0 && age < HASH_CACHE_TTL_MS ? (cache as AppHashCache) : undefined;
}

export async function removeAppHashCache(application_uid: string): Promise<void> {
  await storage;
  await removeItem(`${StorageKeys.ze_hash_cache}:${application_uid}`);
}
