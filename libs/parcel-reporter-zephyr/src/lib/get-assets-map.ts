import * as fs from 'fs';
import { buildAssetsMap, ZeBuildAssetsMap } from 'zephyr-agent';

export interface ParcelOutputAsset {
  name: string;
  filePath: string;
  type: string;
  content?: Buffer | string;
}

export function getAssetsMap(assets: Map<string, ParcelOutputAsset>): ZeBuildAssetsMap {
  // Convert Map to a plain object (Record<string, ParcelOutputAsset>)
  const assetsRecord: Record<string, ParcelOutputAsset> = {};

  // Read content for all assets
  for (const [key, value] of assets.entries()) {
    value.content = fs.readFileSync(value.filePath, 'utf8');

    assetsRecord[key] = value;
  }

  return buildAssetsMap(assetsRecord, extractBuffer, getAssetType);
}

const extractBuffer = (asset: ParcelOutputAsset): string | undefined => {
  if (!asset.content) {
    try {
      return fs.readFileSync(asset.filePath, 'utf8');
    } catch (err) {
      return undefined;
    }
  }

  return typeof asset.content === 'string'
    ? asset.content
    : new TextDecoder().decode(asset.content);
};

const getAssetType = (asset: ParcelOutputAsset): string => {
  const type = asset.type || 'asset';
  return type;
};
