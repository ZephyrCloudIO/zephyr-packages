import { ZeUploadAssetsOptions } from 'zephyr-edge-contract';
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
  const remote_hash_list = await getApplicationHashList({ application_uid });
  if (remote_hash_list) {
    await setAppHashCache(cacheKey, remote_hash_list);
    return { hash_set: new Set(remote_hash_list.hashes) };
  }

  return { hash_set: new Set() };
}

export async function update_hash_list(
  application_uid: string,
  assetsMap: ZeUploadAssetsOptions['assetsMap']
) {
  const cacheKey = await getCacheKey(application_uid);
  const local_hash_list = await getAppHashCache(cacheKey);
  const hashes = Object.keys(assetsMap);
  const new_hashes = new Set([...(local_hash_list?.hashes || []), ...hashes]);
  await setAppHashCache(cacheKey, { hashes: Array.from(new_hashes).sort() });
}
