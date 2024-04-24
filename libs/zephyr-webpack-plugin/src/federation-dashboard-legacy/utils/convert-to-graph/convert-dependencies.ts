import { TopLevelPackage } from './validate-params';
import { LocalPackageJson } from 'zephyr-edge-contract';

export interface ConvertedDependencies {
  dependencies?: LocalPackageJson[];
  devDependencies?: LocalPackageJson[];
  optionalDependencies?: LocalPackageJson[];
}

export type NpmModules = Map<string, Record<string, LocalPackageJson>>;

export function convertDependencies(params: {
  package: TopLevelPackage;
  npmModules: NpmModules;
}): ConvertedDependencies {
  return {
    dependencies: convertDeps(params.npmModules, params.package.dependencies),
    devDependencies: convertDeps(
      params.npmModules,
      params.package.devDependencies
    ),
    optionalDependencies: convertDeps(
      params.npmModules,
      params.package.optionalDependencies
    ),
  };
}

function convertDeps(
  npmModules: NpmModules,
  deps?: Record<string, string>
): LocalPackageJson[] | undefined {
  if (!deps) return;

  return Object.entries(deps).map(([version, name]) => {
    const dataFromGraph = npmModules.get(name);

    const versionVal = version.replace(`${name}-`, '');

    if (dataFromGraph) {
      const foundInGraph = Object.values(dataFromGraph).find((depData) =>
        depData.version.startsWith(versionVal)
      );

      if (foundInGraph) {
        const { name, version, license, size } = foundInGraph;
        return { name, version, license, size };
      }
    }

    return {
      name,
      version: versionVal,
    };
  });
}
