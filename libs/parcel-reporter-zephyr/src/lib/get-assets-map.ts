import * as fs from 'node:fs';
import type { ZeBuildAssetsMap } from 'zephyr-agent';
import { buildAssetsMap, ze_log } from 'zephyr-agent';

export interface ParcelOutputAsset {
  name: string;
  filePath: string;
  type: string;
  content?: Buffer | string;
}

export function getAssetsMap(assets: Map<string, ParcelOutputAsset>): ZeBuildAssetsMap {
  const assetsRecord: Record<string, ParcelOutputAsset> = {};

  for (const [key, value] of assets.entries()) {
    // Keep caller-owned build state immutable. Content is read lazily by extractBuffer.
    assetsRecord[key] = { ...value };
  }

  return buildAssetsMap(assetsRecord, extractBuffer, getAssetType);
}

const extractBuffer = (asset: ParcelOutputAsset): Buffer | string | undefined => {
  if (asset.content === undefined) {
    try {
      return fs.readFileSync(asset.filePath);
    } catch (err) {
      ze_log.upload(err);
      throw err;
    }
  }
  return asset.content;
};

const getAssetType = (asset: ParcelOutputAsset): string => {
  const type = asset.type || 'asset';
  return type;
};
