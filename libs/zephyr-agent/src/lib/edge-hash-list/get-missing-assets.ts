import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';

interface Params {
  assetsMap: ZeBuildAssetsMap;
  hash_set: { hash_set: Set<string> } | null;
}

export function get_missing_assets({ assetsMap, hash_set }: Params) {
  if (!hash_set) {
    return [];
  }

  return Object.keys(assetsMap)
    .filter((hash) => !hash_set.hash_set.has(hash))
    .map((hash) => assetsMap[hash]);
}
