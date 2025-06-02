import type { OutputBundle } from 'rollup';
import type { ZeBuildAssetsMap } from 'zephyr-agent';
import { buildAssetsMap } from 'zephyr-agent';
import { extractRollxBuffer, getRollxAssetType } from 'zephyr-rollx-internal';

export function getAssetsMap(assets: OutputBundle): ZeBuildAssetsMap {
  return buildAssetsMap(assets, extractRollxBuffer, getRollxAssetType);
}
