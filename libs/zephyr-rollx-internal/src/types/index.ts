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
  /** Repack: bundle file name */
  filename?: string;
  /**
   * Repack: Temporary field for repack to store bundle name (in their case it's the
   * actual output js.bundle and they want to put it in filename field)
   */
  bundle_name?: string;
  /** This is not normal MF config, but it's used to support Nx additionalShared */
  additionalShared?:
    | string[]
    | Record<string, string | XFederatedSharedConfig>
    | XAdditionalSharedConfig[]
    | any;
}

export interface ModuleFederationPlugin {
  apply: (compiler: unknown) => void;
  /** For Webpack/Rspack */
  _options?: XFederatedConfig | { config: XFederatedConfig };
  /** Repack specific for now until Repack change how the config should be exposed */
  config?: XFederatedConfig;
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
  needsCodeReference: boolean;
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
