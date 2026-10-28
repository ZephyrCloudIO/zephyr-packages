import type { ZeUploadAssetsOptions } from 'zephyr-edge-contract';
import { getApplicationHashList } from '../edge-requests/get-application-hash-list';
import { getCacheKey } from './get-cache-key';
import { getAppHashCache, setAppHashCache } from '../node-persist/hash-cache';

export async function get_hash_list(application_uid: string): Promise<{
  hash_set: Set<string>;
}> {
  const cacheKey = await getCacheKey(application_uid);
  const local_hash_list = await getAppHashCache(cacheKey);
  if (local_hash_list) {
    return { hash_set: new Set(local_hash_list.hashes) };
  }
  const fetched_at = Date.now();
  const remote_hash_list = await getApplicationHashList({ application_uid });
  if (remote_hash_list) {
    await setAppHashCache(cacheKey, { hashes: remote_hash_list.hashes, fetched_at });
    return { hash_set: new Set(remote_hash_list.hashes) };
  }

  return { hash_set: new Set() };
}

/**
 * Adds uploaded hashes to the cached edge hash list. The entry keeps its fetch time, so
 * it still expires 24h after the list was fetched; without a cached list nothing is
 * written and the next build fetches it from the edge.
 */
export async function update_hash_list(
  application_uid: string,
  assetsMap: ZeUploadAssetsOptions['assetsMap']
) {
  const cacheKey = await getCacheKey(application_uid);
  const local_hash_list = await getAppHashCache(cacheKey);
  if (!local_hash_list) {
    return;
  }
  const hashes = Object.keys(assetsMap);
  const new_hashes = new Set([...local_hash_list.hashes, ...hashes]);
  await setAppHashCache(cacheKey, {
    hashes: Array.from(new_hashes).sort(),
    fetched_at: local_hash_list.fetched_at,
  });
}

/**
 * Drops hashes from the local hash cache so later builds no longer assume those files
 * exist on the edge (e.g. after build retention deleted them).
 */
export async function remove_hashes_from_hash_list(
  application_uid: string,
  hashes: readonly string[]
): Promise<void> {
  const cacheKey = await getCacheKey(application_uid);
  const local_hash_list = await getAppHashCache(cacheKey);
  if (!local_hash_list) {
    return;
  }

  const removed = new Set(hashes);
  await setAppHashCache(cacheKey, {
    hashes: local_hash_list.hashes.filter((hash) => !removed.has(hash)),
    fetched_at: local_hash_list.fetched_at,
  });
}
