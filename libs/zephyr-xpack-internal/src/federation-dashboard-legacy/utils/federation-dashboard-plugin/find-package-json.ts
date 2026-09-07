import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';

type DependencyGroup = 'dependencies' | 'devDependencies' | 'optionalDependencies';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export const findPackageJson = (filePath: string[] | undefined): undefined | unknown => {
  if (!filePath || filePath.length === 0) {
    return;
  }
  if (existsSync(join(filePath.join(sep), 'package.json'))) {
    try {
      const file = readFileSync(join(filePath.join(sep), 'package.json'), 'utf-8');
      return JSON.parse(file);
    } catch (e) {
      console.error(e);
    }
  }
  filePath.pop();
  return findPackageJson(filePath);
};

export function buildVersionedDependencyMap(
  packageJson: PackageJson,
  dependencyGroup: DependencyGroup,
  resolveVersion: (packageName: string) => string | undefined
): Record<string, string> {
  const dependencyNames = Object.keys(packageJson[dependencyGroup] ?? {});

  return dependencyNames.reduce<Record<string, string>>((dependencies, name) => {
    const version = resolveVersion(name);
    if (!version) return dependencies;

    const versionWithoutPatch = version
      .split(/[+-]/, 1)[0]
      .split('.')
      .slice(0, 2)
      .join('.');
    dependencies[`${name}-${versionWithoutPatch}`] = name;
    return dependencies;
  }, {});
}

export function resolveInstalledPackageVersion(
  packageName: string,
  projectRequire: NodeJS.Require
): string | undefined {
  const packageJsonSpecifier = `${packageName}/package.json`;
  try {
    const packageJsonPath = projectRequire.resolve(packageJsonSpecifier);
    return readPackageVersion(packageJsonPath);
  } catch {
    for (const lookupPath of projectRequire.resolve.paths(packageName) ?? []) {
      const version = readPackageVersion(join(lookupPath, packageJsonSpecifier));
      if (version) return version;
    }
  }

  try {
    let currentDirectory = dirname(projectRequire.resolve(packageName));
    while (true) {
      const packageJsonPath = join(currentDirectory, 'package.json');
      const version = readPackageVersion(packageJsonPath);
      if (version) return version;

      const parentDirectory = dirname(currentDirectory);
      if (parentDirectory === currentDirectory) return;
      currentDirectory = parentDirectory;
    }
  } catch {
    return;
  }
}

function readPackageVersion(packageJsonPath: string): string | undefined {
  if (!existsSync(packageJsonPath)) return;

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
      version?: unknown;
    };
    return typeof packageJson.version === 'string' ? packageJson.version : undefined;
  } catch {
    return;
  }
}
