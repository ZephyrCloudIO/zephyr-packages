export interface XPackConfiguration<Compiler> {
  context?: string;
  plugins?: (
    | undefined
    | null
    | false
    | ''
    | 0
    | ((this: Compiler, compiler: Compiler) => void)
    | WebpackPluginInstance<Compiler>
  )[];
  output?:
    | {
        publicPath?: string;
      }
    | any;
}

interface WebpackPluginInstance<Compiler> {
  [index: string]: any;

  /** The run point of the plugin, required method. */
  apply: (compiler: Compiler) => void;
}

export interface XFederatedRemotesConfig {
  name: string;
  library?: {
    type?: string;
  };
  remotes?: (string | RemotesObject)[] | RemotesObject;
  /** Repack: bundle file name */
  filename?: string;
  /**
   * Repack: Temporary field for repack to store bundle name (in their case it's the
   * actual output js.bundle and they want to put it in filename field)
   */
  bundle_name?: string;
  /** Runtime plugins for Module Federation */
  runtimePlugins?: string[];
}

export interface ModuleFederationPlugin {
  apply: (compiler: unknown) => void;
  /** For Webpack/Rspack */
  _options?: XFederatedRemotesConfig | { config: XFederatedRemotesConfig };
  /** For Nx Module Federation plugin */
  options?: XFederatedRemotesConfig | { config: XFederatedRemotesConfig };
  /** Repack specific for now until Repack change how the config should be exposed */
  config?: XFederatedRemotesConfig;
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

export interface XStatsModule {
  identifier?: string;
  reasons?: XStatsReason[];
  moduleType?: string;
  nameForCondition?: string | null;
  size?: number;
  issuerName?: string | null;
  name?: string;
}
export interface XStatsChunk {
  [key: string]: unknown;
  names?: string[];
  origins?: Array<{
    loc?: string;
  }>;
}
export interface XCompiler {
  options: {
    output: {
      uniqueName: string;
    };
    plugins: ModuleFederationPlugin[];
    name: string | undefined;
  };
  plugins: ModuleFederationPlugin[];
  hooks: {
    compilation: {
      tap: (name: string, callback: (compilation: XCompilation) => void) => void;
    };
  };
  webpack: {
    RuntimeGlobals: {
      loadScript: string;
    };
  };
  rspack: {
    RuntimeGlobals: {
      loadScript: string;
    };
  };
}
export interface XCompilation {
  outputOptions: {
    trustedTypes: boolean;
  };
  hooks: {
    /** This is for Webpack */
    additionalModuleRuntimeRequirements: {
      tap: (name: string, callback: (module: XModule, set: Set<string>) => void) => void;
    };
    /** This is for Rspack */
    additionalTreeRuntimeRequirements: {
      tap: (name: string, callback: (chunk: XChunk, set: Set<string>) => void) => void;
    };
  };
}
export interface XModule {
  // I am not empty I am just useless
  type: string;
}
export interface XChunk {
  id?: string | number | null;
  getAllReferencedChunks: () => Iterable<XChunk>;
}
interface XStatsReason {
  module?: string | null;
  userRequest?: string | null;
  resolvedModule?: string | null;
}
export interface XStats {
  compilation: {
    name?: string;
    namedChunks: ReadonlyMap<string, Readonly<XChunk>>;
    options: {
      context?: string;
    };
  };
  toJson: () => XStatsCompilation;
}

export interface XStatsCompilation {
  publicPath?: string;
  hash?: string;
  modules?: XStatsModule[];
  chunks?: XStatsChunk[];
}
