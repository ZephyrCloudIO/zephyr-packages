import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { persistentStorage, storage } from './storage';
import { StorageKeys } from './storage-keys';

function get_key(application_uid: string): string {
  return [StorageKeys.ze_app_partial_asset_map, application_uid].join('.');
}

export async function savePartialAssetMap(
  application_uid: string,
  partial_key: string,
  assetMap: ZeBuildAssetsMap
): Promise<void> {
  await storage;
  const key = get_key(application_uid);
  const partial_asset_map = await persistentStorage.getItem(key);
  void (await persistentStorage.setItem(
    key,
    Object.assign({}, partial_asset_map || {}, { [partial_key]: assetMap })
  ));
}

export async function getPartialAssetMap(
  application_uid: string
): Promise<ZeBuildAssetsMap | undefined> {
  await storage;
  return persistentStorage.getItem(get_key(application_uid));
}

export async function removePartialAssetMap(
  application_uid: string
): Promise<void> {
  await storage;
  await persistentStorage.removeItem(get_key(application_uid));
}
