import { ZeUploadAssetsOptions, _hash_cache } from 'zephyr-edge-contract';
import { getApplicationHashList } from '../ze-api-requests/get-application-hash-list';
import { getCacheKey } from './get-cache-key';

export async function get_hash_list(application_uid: string): Promise<{ hash_set: Set<string> }> {
  const cacheKey = await getCacheKey(application_uid);
  const local_hash_list = await _hash_cache.getAppHashCache(cacheKey);
  if (local_hash_list) {
    return { hash_set: new Set(local_hash_list.hashes) };
  }
  const remote_hash_list = await getApplicationHashList({ application_uid });
  if (remote_hash_list) {
    await _hash_cache.setAppHashCache(cacheKey, remote_hash_list);
    return { hash_set: new Set(remote_hash_list.hashes) };
  }

  return { hash_set: new Set() };
}

export async function update_hash_list(application_uid: string, assetsMap: ZeUploadAssetsOptions['assetsMap']) {
  const cacheKey = await getCacheKey(application_uid);
  const hashes = Object.values(assetsMap).map(({ hash }) => hash);
  await _hash_cache.setAppHashCache(cacheKey, { hashes });
}
