export interface ZephyrOutputChunk {
  type: 'chunk';
  code: string;
  fileName: string;
  name?: string;
}

export interface ZephyrOutputAsset {
  type: 'asset';
  source: string | Uint8Array;
  fileName: string;
  name?: string;
  names?: string[];
  needsCodeReference?: boolean;
  originalFileName?: string | null;
  originalFileNames?: string[] | null;
}

export type ZephyrOutput = ZephyrOutputChunk | ZephyrOutputAsset;
export type ZephyrOutputBundle = Record<string, ZephyrOutput>;
