export interface XFederatedSharedConfig {
  singleton?: boolean;
  requiredVersion?: string;
  version?: string;
  eager?: boolean;
  /**
   * This usually doesn't exist in the config, but it's used to support Nx
   * additionalShared
   */
  libraryName?: string;
}

export interface XAdditionalSharedConfig {
  libraryName: string;
  sharedConfig?: {
    singleton?: boolean;
    requiredVersion?: string;
  };
}

export interface XFederatedConfig {
  name: string;
  library?:
    | {
        type?: string;
      }
    | any;
  shared?: Record<string, string | XFederatedSharedConfig> | string[] | any;
  remotes?: (string | RemotesObject)[] | RemotesObject | any;
  exposes?: Record<string, string | { import: string } | any> | any;
  filename?: string;
  /** This is not normal MF config, but it's used to support Nx additionalShared */
  additionalShared?:
    | string[]
    | Record<string, string | XFederatedSharedConfig>
    | XAdditionalSharedConfig[]
    | any;
}

interface RemotesObject {
  [index: string]: string | RemotesConfig | string[];
}

interface RemotesConfig {
  /** Container locations from which modules should be resolved and loaded at runtime. */
  external: string | string[];

  /** The name of the share scope shared with this remote. */
  shareScope?: string;
}

export interface XPreRenderdAsset {
  names: string[];
  originalFileNames: string[];
  source: string | Uint8Array;
  type: 'asset';
}

export interface XOutputAsset extends XPreRenderdAsset {
  fileName: string;
  needsCodeReference?: boolean;
}

export interface XPreRenderedChunk {
  name: string;
  moduleIds: string[];
  referencedFiles?: string[];
  modules?: Record<string, string | any>;
}

export interface XOutputChunk extends XPreRenderedChunk {
  type: 'chunk';
  code: string;
  source?: string;
  sourcemap?: string;
  facadeModuleId: string | null;
  dynamicImports?: string[];
  file?: string;
  fileName: string;
  isEntry: boolean;
  exports: string[];
  imports: string[];
}

/** Vite like output bundle */
export type XOutputBundle<T = XOutputAsset | XOutputChunk> = Record<string, T>;

/**
 * Generic Module Federation Options type Compatible with Vite, Webpack, and Rolldown MF
 * plugins
 */
export type ModuleFederationOptions = XFederatedConfig;
