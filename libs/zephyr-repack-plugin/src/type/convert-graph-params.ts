import { StatsChunk, StatsModule } from '@rspack/core';
import { TopLevelPackage } from './federation-plugin-options';

// TODO: check if all params correct
export interface ConvertToGraphParams {
  /** Application name in module federation config */
  name?: string;
  /** Required filename in React Native actual output js.bundle */
  filename?: string;
  /** Key of remotes as a string of arrays */
  remotes?: unknown;
  /**
   * Chunk of the remote entry,
   *
   * // TODO: in MF2 should it be js.bundle or mf-manifest.json?
   */
  federationRemoteEntry: StatsChunk | undefined;
  /**
   * Module compilation results return from getStats(), typically includes all chunks and
   * modules needed for the build
   */
  modules?: StatsModule[];
  /**
   * Shared packages in package.json, an Object of Record<string, any>, could be
   * `dependencies`, `devDependencies` or `optionalDependencies`
   */
  topLevelPackage: TopLevelPackage;
  /** PublicPath from getStats().toJson() */
  publicPath?: string;
  // replace with the actual type of environment
  metadata: {
    remote?: string;
    /** //TODO */
    source?: { url?: string };
  };
  // replace with the actual type of environment
  versionData?: never;
  // replace with the actual type of environment
  /**
   * Either `development` or other development enviornment (`production`), default to
   * `development` if not specified
   */
  environment?: string;
  /** Computed version based on file hash and _options.versionStrategy // */
  version?: string;
  /** Date.now() if not specified */
  posted?: Date;
  /** 'default' if not specified, not sure what it does and what it's supposed to do */
  group?: string;
  // replace with the actual type of functionRemotes
  /** //TODO: unsure what it does */
  functionRemotes: [file: string, applicationID: string, name: string][];
  /** Git sha */
  sha?: string;
  /** GetStats()'s hash */
  buildHash?: string;
  /**
   * Include referenced chunks in a remote, if the host app doesn't expose anything it
   * will be empty
   */
  chunkDependencies: unknown;
  /** 'ios' | 'android' | 'web' | undefined */
  target?: 'ios' | 'android' | 'web' | undefined;
}
