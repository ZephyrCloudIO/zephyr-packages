/**
 * These types are shared across multiple bundler plugins, providing a consistent type
 * system
 *
 * @file Core type definitions for Zephyr plugins
 */

// ----------- Common Types for All Plugins -----------

/**
 * Base plugin options interface
 *
 * All Zephyr plugins can extend this interface to add their own specific options
 *
 * @interface ZePluginOptions
 */
export interface ZePluginOptions {
  /**
   * Optional flag to wait for index.html generation before finalizing the build
   *
   * @type {boolean}
   * @optional
   */
  wait_for_index_html?: boolean;

  /**
   * Module Federation configuration
   *
   * The type is kept generic as different bundlers use different configurations
   *
   * @type {unknown}
   * @optional
   */
  mfConfig?: unknown;
}

/**
 * Internal options used by all Zephyr plugins
 *
 * These options are used internally by the plugins and are not exposed to users
 *
 * @interface ZeInternalPluginOptions
 */
export interface ZeInternalPluginOptions {
  /**
   * The Zephyr Engine instance (imported from zephyr-agent)
   *
   * @type {unknown}
   */
  zephyr_engine: unknown;

  /**
   * Plugin name for logging and diagnostics
   *
   * @type {string}
   */
  pluginName: string;

  /**
   * Module Federation configuration
   *
   * @type {unknown}
   * @optional
   */
  mfConfig?: unknown;

  /**
   * Optional flag to wait for index.html generation before finalizing the build
   *
   * @type {boolean}
   * @optional
   */
  wait_for_index_html?: boolean;
}

/**
 * Supported bundler types for Zephyr plugins
 *
 * @typedef {string} ZeBundlerType
 */
export type ZeBundlerType =
  | 'webpack'
  | 'rspack'
  | 'repack'
  | 'vite'
  | 'rollup'
  | 'rolldown'
  | 'unknown';

/**
 * Common asset interface used across plugins
 *
 * @interface ZeBuildAsset
 */
export interface ZeBuildAsset {
  /**
   * Asset name/path
   *
   * @type {string}
   */
  name: string;

  /**
   * Asset source content
   *
   * @type {string | Buffer}
   */
  source: string | Buffer;

  /**
   * Asset size in bytes
   *
   * @type {number}
   */
  size: number;
}

/**
 * Map of assets by their path
 *
 * @typedef {Record<string, ZeBuildAsset>} ZeBuildAssetsMap
 */
export type ZeBuildAssetsMap = Record<string, ZeBuildAsset>;

/**
 * Dependency information
 *
 * @interface ZeDependency
 */
export interface ZeDependency {
  /**
   * Package name
   *
   * @type {string}
   */
  name: string;

  /**
   * Package version
   *
   * @type {string}
   */
  version: string;
}

// ----------- Webpack/Rspack Specific Types -----------

/**
 * Common configuration interface for webpack and rspack
 *
 * @template Compiler - The compiler type
 * @interface XPackConfiguration
 */
export interface XPackConfiguration<Compiler> {
  /**
   * Context path for the compilation
   *
   * @type {string}
   * @optional
   */
  context?: string;

  /**
   * Array of plugins
   *
   * @type {(
   *   | WebpackPluginInstance<Compiler>
   *   | ((this: Compiler, compiler: Compiler) => void)
   *   | undefined
   *   | null
   *   | false
   *   | ''
   *   | 0
   * )[]}
   * @optional
   */
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

/**
 * Interface for webpack plugin instances
 *
 * @template Compiler - The compiler type
 * @interface WebpackPluginInstance
 */
interface WebpackPluginInstance<Compiler> {
  // Allow for extra properties with unknown type
  [index: string]: unknown;

  /**
   * The run point of the plugin, required method
   *
   * @param {Compiler} compiler - The webpack compiler instance
   * @returns {void}
   */
  apply: (compiler: Compiler) => void;
}

/**
 * Module Federation configuration interface
 *
 * @interface XFederatedRemotesConfig
 */
export interface XFederatedRemotesConfig {
  /**
   * The name of the module federation container
   *
   * @type {string}
   */
  name: string;

  /**
   * Library configuration
   *
   * @type {{ type?: string }}
   * @optional
   */
  library?: {
    type?: string;
  };

  /**
   * Remote modules configuration
   *
   * @type {(string | RemotesObject)[] | RemotesObject}
   * @optional
   */
  remotes?: (string | RemotesObject)[] | RemotesObject;

  /**
   * Bundle file name
   *
   * @type {string}
   * @optional
   */
  filename?: string;

  /**
   * Temporary field for repack to store bundle name
   *
   * In Repack's case, it's the actual output js.bundle and they want to put it in
   * filename field
   *
   * @type {string}
   * @optional
   */
  bundle_name?: string;
}

/**
 * Module Federation Plugin interface
 *
 * @interface ModuleFederationPlugin
 */
export interface ModuleFederationPlugin {
  /**
   * Apply method for the plugin
   *
   * @param {unknown} compiler - The compiler instance
   * @returns {void}
   */
  apply: (compiler: unknown) => void;

  /**
   * Options for Webpack/Rspack
   *
   * @type {XFederatedRemotesConfig}
   * @optional
   */
  _options?: XFederatedRemotesConfig;

  /**
   * Repack specific configuration
   *
   * Used until Repack changes how the config should be exposed
   *
   * @type {XFederatedRemotesConfig}
   * @optional
   */
  config?: XFederatedRemotesConfig;

  // Adding index signature to satisfy WebpackPluginInstance constraint
  [index: string]: unknown;
}

/**
 * Remotes object interface for Module Federation
 *
 * @interface RemotesObject
 */
interface RemotesObject {
  /**
   * Index signature for remote entries
   *
   * @type {string | RemotesConfig | string[]}
   */
  [index: string]: string | RemotesConfig | string[];
}

/**
 * Configuration for remote modules
 *
 * @interface RemotesConfig
 */
interface RemotesConfig {
  /**
   * Container locations from which modules should be resolved and loaded at runtime
   *
   * @type {string | string[]}
   */
  external: string | string[];

  /**
   * The name of the share scope shared with this remote
   *
   * @type {string}
   * @optional
   */
  shareScope?: string;
}

/**
 * Stats module interface
 *
 * @interface XStatsModule
 */
export interface XStatsModule {
  /**
   * Module identifier
   *
   * @type {string}
   * @optional
   */
  identifier?: string;

  /**
   * Reasons for including this module
   *
   * @type {XStatsReason[]}
   * @optional
   */
  reasons?: XStatsReason[];

  /**
   * Module type
   *
   * @type {string}
   * @optional
   */
  moduleType?: string;

  /**
   * Name for condition
   *
   * @type {string | null}
   * @optional
   */
  nameForCondition?: string | null;

  /**
   * Module size
   *
   * @type {number}
   * @optional
   */
  size?: number;

  /**
   * Issuer name
   *
   * @type {string | null}
   * @optional
   */
  issuerName?: string | null;

  /**
   * Module name
   *
   * @type {string}
   * @optional
   */
  name?: string;
}

/**
 * Stats chunk interface
 *
 * @interface XStatsChunk
 */
export interface XStatsChunk {
  /**
   * Index signature for unknown properties
   *
   * @type {unknown}
   */
  [key: string]: unknown;

  /**
   * Chunk names
   *
   * @type {string[]}
   * @optional
   */
  names?: string[];

  /**
   * Chunk origins
   *
   * @type {{ loc?: string }[]}
   * @optional
   */
  origins?: Array<{
    loc?: string;
  }>;
}

/**
 * Compiler interface for webpack and rspack
 *
 * @interface XCompiler
 */
export interface XCompiler {
  /**
   * Compiler options
   *
   * @type {{ output: { uniqueName: string }; plugins: ModuleFederationPlugin[] }}
   */
  options: {
    output: {
      uniqueName: string;
    };
    plugins: ModuleFederationPlugin[];
  };

  /**
   * Compiler plugins
   *
   * @type {ModuleFederationPlugin[]}
   */
  plugins: ModuleFederationPlugin[];

  /**
   * Compiler hooks
   *
   * @type {{
   *   compilation: {
   *     tap: (name: string, callback: (compilation: XCompilation) => void) => void;
   *   };
   * }}
   */
  hooks: {
    compilation: {
      tap: (name: string, callback: (compilation: XCompilation) => void) => void;
    };
  };

  /**
   * Webpack runtime globals
   *
   * @type {{ RuntimeGlobals: { loadScript: string } }}
   */
  webpack: {
    RuntimeGlobals: {
      loadScript: string;
    };
  };

  /**
   * Rspack runtime globals
   *
   * @type {{ RuntimeGlobals: { loadScript: string } }}
   */
  rspack: {
    RuntimeGlobals: {
      loadScript: string;
    };
  };
}

/**
 * Compilation interface for webpack and rspack
 *
 * @interface XCompilation
 */
export interface XCompilation {
  /**
   * Output options
   *
   * @type {{ trustedTypes: boolean }}
   */
  outputOptions: {
    trustedTypes: boolean;
  };

  /**
   * Compilation hooks
   *
   * @type {{
   *   additionalModuleRuntimeRequirements: {
   *     tap: (
   *       name: string,
   *       callback: (module: XModule, set: Set<string>) => void
   *     ) => void;
   *   };
   *   additionalTreeRuntimeRequirements: {
   *     tap: (name: string, callback: (chunk: XChunk, set: Set<string>) => void) => void;
   *   };
   * }}
   */
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

/**
 * Module interface
 *
 * @interface XModule
 */
export interface XModule {
  /**
   * Module type
   *
   * @type {string}
   */
  type: string;
}

/**
 * Chunk interface
 *
 * @interface XChunk
 */
export interface XChunk {
  /**
   * Chunk ID
   *
   * @type {string | number | null}
   * @optional
   */
  id?: string | number | null;

  /**
   * Gets all referenced chunks
   *
   * @returns {Iterable<XChunk>}
   */
  getAllReferencedChunks: () => Iterable<XChunk>;
}

/**
 * Stats reason interface
 *
 * @interface XStatsReason
 */
interface XStatsReason {
  /**
   * Module name
   *
   * @type {string | null}
   * @optional
   */
  module?: string | null;

  /**
   * User request
   *
   * @type {string | null}
   * @optional
   */
  userRequest?: string | null;

  /**
   * Resolved module
   *
   * @type {string | null}
   * @optional
   */
  resolvedModule?: string | null;
}

/**
 * Stats interface
 *
 * @interface XStats
 */
export interface XStats {
  /**
   * Compilation information
   *
   * @type {{
   *   name?: string;
   *   namedChunks: ReadonlyMap<string, Readonly<XChunk>>;
   *   options: { context?: string };
   * }}
   */
  compilation: {
    name?: string;
    namedChunks: ReadonlyMap<string, Readonly<XChunk>>;
    options: {
      context?: string;
    };
  };

  /**
   * Converts stats to JSON
   *
   * @returns {XStatsCompilation}
   */
  toJson: () => XStatsCompilation;
}

/**
 * Stats compilation interface
 *
 * @interface XStatsCompilation
 */
export interface XStatsCompilation {
  /**
   * Public path
   *
   * @type {string}
   * @optional
   */
  publicPath?: string;

  /**
   * Compilation hash
   *
   * @type {string}
   * @optional
   */
  hash?: string;

  /**
   * Modules in the compilation
   *
   * @type {XStatsModule[]}
   * @optional
   */
  modules?: XStatsModule[];

  /**
   * Chunks in the compilation
   *
   * @type {XStatsChunk[]}
   * @optional
   */
  chunks?: XStatsChunk[];
}
