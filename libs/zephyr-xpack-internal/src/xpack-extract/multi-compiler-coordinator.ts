import * as path from 'node:path';
import type { ZephyrEngine } from 'zephyr-agent';
import {
  XPackBuildCoordinator,
  type XPackBuildCoordinatorOptions,
} from './xpack-build-coordinator';

export interface XPackCompilerConfigLike {
  name?: string;
  context?: string;
  target?: string | false | string[];
  output?: { path?: string };
  dependencies?: string[];
}

export interface CoordinatedCompiler {
  participant: string;
  role: 'client' | 'server';
  assetPrefix?: string;
}

function isServerTarget(target: XPackCompilerConfigLike['target']): boolean {
  const targets = Array.isArray(target) ? target : [target];
  return targets.some(
    (item) =>
      typeof item === 'string' &&
      /^(?:(?:async-)?node(?:\d+(?:\.\d+)*)?|electron-main)$/.test(item)
  );
}

function commonDirectory(paths: readonly string[]): string | undefined {
  if (paths.length === 0) {
    return undefined;
  }
  const split = paths.map((item) => path.resolve(item).split(path.sep));
  const length = Math.min(...split.map((parts) => parts.length));
  let index = 0;
  while (index < length && split.every((parts) => parts[index] === split[0]?.[index])) {
    index += 1;
  }
  const common = split[0]?.slice(0, index).join(path.sep);
  return common ? common || path.parse(paths[0]).root : undefined;
}

export function coordinateXPackCompilers(
  engine: ZephyrEngine,
  configs: readonly XPackCompilerConfigLike[],
  options: XPackBuildCoordinatorOptions = {}
): {
  coordinator: XPackBuildCoordinator;
  compilers: readonly CoordinatedCompiler[];
} {
  const usedNames = new Set<string>();
  const outputPaths = configs
    .map((config) => config.output?.path)
    .filter((item): item is string => !!item);
  const outputRoot =
    outputPaths.length === configs.length ? commonDirectory(outputPaths) : undefined;
  const hasDistinctOutputPaths =
    new Set(outputPaths.map((item) => path.resolve(item))).size > 1;

  const compilers = configs.map((config, index): CoordinatedCompiler => {
    const role = isServerTarget(config.target) ? 'server' : 'client';
    const baseName = config.name?.trim() || `${role}-${index}`;
    let participant = baseName;
    let suffix = 1;
    while (usedNames.has(participant)) {
      participant = `${baseName}-${suffix++}`;
    }
    usedNames.add(participant);

    let assetPrefix: string | undefined;
    if (hasDistinctOutputPaths && outputRoot && config.output?.path) {
      const relative = path.relative(outputRoot, path.resolve(config.output.path));
      if (relative && relative !== '.' && !relative.startsWith('..')) {
        assetPrefix = relative.split(path.sep).join('/');
      }
    }
    return { participant, role, assetPrefix };
  });

  const inferredSnapshotType = compilers.some(({ role }) => role === 'server')
    ? 'ssr'
    : 'csr';
  const participantByConfigName = new Map<string, string>();
  configs.forEach((config, index) => {
    if (config.name?.trim() && compilers[index]) {
      participantByConfigName.set(config.name.trim(), compilers[index].participant);
    }
  });
  const coordinator = new XPackBuildCoordinator(
    engine,
    compilers.map(({ participant, role }, index) => ({
      name: participant,
      role,
      dependencies: (configs[index]?.dependencies ?? []).map(
        (dependency) => participantByConfigName.get(dependency) ?? dependency
      ),
    })),
    { ...options, snapshotType: options.snapshotType ?? inferredSnapshotType }
  );
  return { coordinator, compilers };
}
