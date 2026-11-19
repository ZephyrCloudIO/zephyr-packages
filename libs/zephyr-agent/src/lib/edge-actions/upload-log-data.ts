import type { ZeBuildAsset, ZeBuildAssetsMap } from 'zephyr-edge-contract';
import type { JsonValue } from '../logging/ze-log-event';

const LARGEST_ASSETS_LIMIT = 5;

/** Size of an asset as uploaded: its buffer when present, otherwise its declared size. */
export function assetBytes(asset: ZeBuildAsset, assetsMap: ZeBuildAssetsMap): number {
  return assetsMap[asset.hash]?.buffer?.length ?? asset.size ?? 0;
}

/** `data` for `snapshot:assets:upload:done`. */
export function assetsUploadDoneData(props: {
  missingAssets: readonly ZeBuildAsset[];
  assetsMap: ZeBuildAssetsMap;
  bytes: number;
  durationMs: number;
}): Record<string, JsonValue> {
  const { missingAssets, assetsMap, bytes, durationMs } = props;

  const largest_assets = missingAssets
    .map((asset) => ({ path: asset.path, bytes: assetBytes(asset, assetsMap) }))
    .sort((left, right) => right.bytes - left.bytes)
    .slice(0, LARGEST_ASSETS_LIMIT);

  return {
    assets_uploaded: missingAssets.length,
    assets_total: Object.keys(assetsMap).length,
    bytes,
    duration_ms: durationMs,
    outcome: 'uploaded',
    largest_assets,
  };
}

/** `data` for `snapshot:assets:upload:empty`. */
export function assetsUploadEmptyData(
  assetsMap: ZeBuildAssetsMap
): Record<string, JsonValue> {
  return {
    assets_uploaded: 0,
    assets_total: Object.keys(assetsMap).length,
    bytes: 0,
    outcome: 'skipped',
  };
}
