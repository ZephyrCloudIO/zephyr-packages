export interface Asset {
  /**
   * the filename of the asset
   */
  name: string;

  /**
   * source of the asset
   */
  source: Source;

  /**
   * info about the asset
   */
  info: KnownAssetInfo;
}

interface KnownAssetInfo {
  /**
   * true, if the asset can be long term cached forever (contains a hash)
   */
  immutable?: boolean;

  /**
   * whether the asset is minimized
   */
  minimized?: boolean;

  /**
   * the value(s) of the full hash used for this asset
   */
  fullhash?: string | string[];

  /**
   * the value(s) of the chunk hash used for this asset
   */
  chunkhash?: string | string[];

  /**
   * the value(s) of the module hash used for this asset
   */
  modulehash?: string | string[];

  /**
   * the value(s) of the content hash used for this asset
   */
  contenthash?: string | string[];

  /**
   * when asset was created from a source file (potentially transformed), the original filename relative to compilation context
   */
  sourceFilename?: string;

  /**
   * size in bytes, only set after asset has been emitted
   */
  size?: number;

  /**
   * true, when asset is only used for development and doesn't count towards user-facing assets
   */
  development?: boolean;

  /**
   * true, when asset ships data for updating an existing application (HMR)
   */
  hotModuleReplacement?: boolean;

  /**
   * true, when asset is javascript and an ESM
   */
  javascriptModule?: boolean;

  /**
   * object of pointers to other assets, keyed by type of relation (only points from parent to child)
   */
  related?: Record<string, string | string[]>;
}

export interface Source {
  size(): number;
  source(): string | Buffer;
  buffer(): Buffer;
}

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
  asset_time?: number;
}
