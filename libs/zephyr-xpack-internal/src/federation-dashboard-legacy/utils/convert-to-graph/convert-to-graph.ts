/** Eslint-disable */
import type { TopLevelPackage } from './validate-params';
import { modulePartOne } from './module-part-one';
import { convertDependencies } from './convert-dependencies';
import { modulePartTwo } from './module-part-two';
import { processFunctionRemotes } from './process-function-remotes';

// import { StatsChunk, StatsModule } from 'webpack';
import type { XStatsChunk, XStatsModule } from '../../../xpack.types';
import type { ConvertedGraph } from 'zephyr-edge-contract';

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
  federationRemoteEntry: XStatsChunk | undefined;
  /**
   * Module compilation results return from getStats(), typically includes all chunks and
   * modules needed for the build
   */
  modules?: XStatsModule[];
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
  /** Repack specific 'ios' | 'android' | 'web' | undefined */
  target?: 'ios' | 'android' | 'web' | undefined;
}

export function convertToGraph(
  params: ConvertToGraphParams
  // standalone?: boolean
): ConvertedGraph {
  const {
    name,
    // federationRemoteEntry,
    modules,
    topLevelPackage,
    metadata,
    versionData,
    environment,
    version,
    posted,
    group,
    functionRemotes,
    sha,
    buildHash,
    target,
  } = params;

  // validateParams(
  //   { federationRemoteEntry, modules, topLevelPackage /*, metadata*/ },
  //   standalone
  // );

  const { consumes, modulesObj, npmModules } = modulePartOne(modules);

  const convertedDeps = convertDependencies({
    package: topLevelPackage,
    npmModules,
  });

  const { overrides } = modulePartTwo({
    name,
    modules,
    modulesObj,
    convertedDeps,
  });

  processFunctionRemotes({ functionRemotes, consumes });

  const sourceUrl = metadata?.source?.url ?? '';
  const remote = metadata?.remote ?? '';

  return {
    ...convertedDeps,
    id: name,
    name,
    remote,
    metadata,
    build_target: target,
    versionData,
    overrides: Object.values(overrides),
    consumes: consumes.map((con) => ({
      ...con,
      usedIn: Array.from(con.usedIn.values()).map((file) => ({
        file,
        url: `${sourceUrl}/${file}`,
      })),
    })),
    modules: Object.values(modulesObj).map((mod) => ({
      ...mod,
      requires: Array.from(mod.requires.values()).filter(
        (value) => typeof value === 'string'
      ),
    })),
    environment,
    version,
    posted,
    group,
    sha,
    buildHash,
  };
}
