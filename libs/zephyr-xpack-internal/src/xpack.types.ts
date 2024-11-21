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
}

interface WebpackPluginInstance<Compiler> {
  [index: string]: any;

  /** The run point of the plugin, required method. */
  apply: (compiler: Compiler) => void;
}

export interface ModuleFederationPlugin {
  apply: (compiler: unknown) => void;
  _options: {
    library?: {
      type?: string;
    };
    remotes?: (string | RemotesObject)[] | RemotesObject;
  };
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
  nameForCondition?: string;
  size?: number;
  issuerName?: string;
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
}
export interface XCompilation {
  outputOptions: {
    trustedTypes: boolean;
  };
  hooks: {
    additionalModuleRuntimeRequirements: {
      tap: (name: string, callback: (module: XModule, set: Set<string>) => void) => void;
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
  module?: string;
  userRequest?: string;
  resolvedModule?: string;
}
export interface XStats {
  compilation: {
    options: {
      context?: string;
    };
    namedChunks: ReadonlyMap<string, Readonly<XChunk>>;
  };
}

export interface XStatsCompilation {
  publicPath?: string;
  hash?: string;
  modules?: XStatsModule[];
  chunks?: XStatsChunk[];
}
