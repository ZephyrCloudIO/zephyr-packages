/* istanbul ignore file */

export interface Asset {
  /** The filename of the asset */
  name: string;

  /** Source of the asset */
  source: Source;

  /** Info about the asset */
  info: KnownAssetInfo;
}

interface KnownAssetInfo {
  /** True, if the asset can be long term cached forever (contains a hash) */
  immutable?: boolean;

  /** Whether the asset is minimized */
  minimized?: boolean;

  /** The value(s) of the full hash used for this asset */
  fullhash?: string | string[];

  /** The value(s) of the chunk hash used for this asset */
  chunkhash?: string | string[];

  /** The value(s) of the module hash used for this asset */
  modulehash?: string | string[];

  /** The value(s) of the content hash used for this asset */
  contenthash?: string | string[];

  /**
   * When asset was created from a source file (potentially transformed), the original
   * filename relative to compilation context
   */
  sourceFilename?: string;

  /** Size in bytes, only set after asset has been emitted */
  size?: number;

  /**
   * True, when asset is only used for development and doesn't count towards user-facing
   * assets
   */
  development?: boolean;

  /** True, when asset ships data for updating an existing application (HMR) */
  hotModuleReplacement?: boolean;

  /** True, when asset is javascript and an ESM */
  javascriptModule?: boolean;

  /**
   * Object of pointers to other assets, keyed by type of relation (only points from
   * parent to child)
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
  missingAssets: ZeBuildAsset[];
  assetsMap: {
    [key: string]: ZeBuildAsset;
  };
}

export interface ZeBuildAsset {
  path: string;
  extname: string;
  hash: string;
  size: number; // Size in bytes
  buffer: Buffer | string;
}

export interface ZeBuildAssetsMap {
  [key: string]: ZeBuildAsset;
}

export interface SnapshotUploadRes {
  urls: { version: string };
  assets: ZeBuildAsset[];
  assets_v2?: ZeBuildAsset[];
  asset_time?: number;
  asset_v2_time?: number;
  message?: string;
}

/** OTA Version Check Response */
export interface OTAVersionResponse {
  /** Current deployed version identifier */
  version: string;
  /** ISO timestamp of when this version was deployed */
  timestamp: string;
  /** URL to fetch the manifest for this version */
  manifest_url: string;
  /** Optional release notes or update description */
  description?: string;
  /** Whether this is a critical update that should be applied immediately */
  critical?: boolean;
}

/** OTA Check Request */
export interface OTACheckRequest {
  /** Application UID */
  application_uid: string;
  /** Current version the client has (optional for first check) */
  current_version?: string;
  /** Current manifest timestamp the client has */
  current_timestamp?: string;
}
