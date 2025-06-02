import {
  buildAssetsMap,
  getPartialAssetMap,
  removePartialAssetMap,
  type ZeBuildAssetsMap,
  type ZephyrEngine,
} from 'zephyr-agent';
import { extractRollxBuffer, getRollxAssetType } from 'zephyr-rollx-internal';
import type { ZephyrInternalOptions } from '../types/zephyr-internal-options';
import { loadStaticAssets } from './load_static_assets';

export async function extract_vite_assets_map(
  zephyr_engine: ZephyrEngine,
  vite_internal_options: ZephyrInternalOptions
): Promise<ZeBuildAssetsMap> {
  const application_uid = zephyr_engine.application_uid;
  const assets = await loadStaticAssets(vite_internal_options);
  const partialAssetMap = await getPartialAssetMap(application_uid);
  await removePartialAssetMap(application_uid);

  const runtime_assets = vite_internal_options.assets;
  const complete_assets = Object.assign(
    {},
    assets,
    ...Object.values(partialAssetMap ?? {}),
    runtime_assets
  );
  return buildAssetsMap(complete_assets, extractRollxBuffer, getRollxAssetType);
}
