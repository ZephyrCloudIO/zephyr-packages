import { getRollxAssetsMap } from 'zephyr-rollx-internal';
import type { ZeBuildAssetsMap } from 'zephyr-agent';
import type { XOutputAsset, XOutputBundle, XOutputChunk } from 'zephyr-rollx-internal';

export function getAssetsMap(
  assets: XOutputBundle<XOutputChunk | XOutputAsset>
): ZeBuildAssetsMap {
  return getRollxAssetsMap(assets);
}
