/** Eslint-disable */
import { TopLevelPackage } from './validate-params';
import { modulePartOne } from './module-part-one';
import { convertDependencies } from './convert-dependencies';
import { modulePartTwo } from './module-part-two';
import { processFunctionRemotes } from './process-function-remotes';

import { StatsChunk, StatsModule } from 'webpack';
import { ConvertedGraph } from 'zephyr-edge-contract';

export interface ConvertToGraphParams {
  name?: string;
  remotes?: unknown;
  federationRemoteEntry: StatsChunk | undefined;
  modules?: StatsModule[];
  topLevelPackage: TopLevelPackage;
  publicPath?: string;
  // replace with the actual type of environment
  metadata: {
    remote?: string;
    source?: { url?: string };
  };
  // replace with the actual type of environment
  versionData?: never;
  // replace with the actual type of environment
  environment?: string;
  version?: string;
  posted?: Date;
  group?: string;
  // replace with the actual type of functionRemotes
  functionRemotes: [file: string, applicationID: string, name: string][];
  sha?: string;
  buildHash?: string;
  chunkDependencies: unknown;
}

export function convertToGraph(
  params: ConvertToGraphParams,
  standalone?: boolean
): ConvertedGraph {
  const {
    name,
    federationRemoteEntry,
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
