import { getItem, init, setItem, removeItem } from 'node-persist';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { StorageKeys, ZE_PATH } from './storage-keys';
import { ZeBuildAssetsMap } from '../zephyr-edge-contract';

const storage = init({
  dir: join(homedir(), ZE_PATH),
});

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
  const partial_asset_map = await getItem(key);
  void (await setItem(
    key,
    Object.assign({}, partial_asset_map || {}, { [partial_key]: assetMap })
  ));
}

export async function getPartialAssetMap(
  application_uid: string
): Promise<ZeBuildAssetsMap | undefined> {
  await storage;
  return getItem(get_key(application_uid));
}

export async function removePartialAssetMap(
  application_uid: string
): Promise<void> {
  await storage;
  await removeItem(get_key(application_uid));
}
