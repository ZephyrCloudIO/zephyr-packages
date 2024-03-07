import { Asset } from 'webpack';

export type Source = Asset['source'];

export interface UploadableAsset {
  path: string;
  extname: string;
  hash: string;
  size: number;
  buffer: Buffer | string;
}

export interface ZeUploadAssetsOptions {
  missingAssets: SnapshotUploadRes | undefined;
  count: number;
  assetsMap: {
    [key: string]: ZeBuildAsset;
  };
}

export interface ZeBuildAsset {
  path: string;
  extname: string;
  hash: string;
  size: number;
  buffer: Buffer | string;
}

export interface ZeBuildAssetsMap {
  [key: string]: ZeBuildAsset;
}

export interface SnapshotUploadRes {
  id: string;
  assets: ZeBuildAsset[];
  message: string;
}
