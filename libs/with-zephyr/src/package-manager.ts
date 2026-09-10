import { execSync } from 'child_process';
import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';
import type { PackageManager } from './types.js';

/** Detect the package manager being used in the project */
export function detectPackageManager(directory: string = process.cwd()): PackageManager {
  // Priority 1: Check which CLI is actually running (npm_config_user_agent)
  // This is most accurate when someone runs `pnpm dlx with-zephyr` or `npx with-zephyr`
  if (process.env['npm_config_user_agent']) {
    const userAgent = process.env['npm_config_user_agent'].toLowerCase();
    if (userAgent.includes('pnpm')) return 'pnpm';
    if (userAgent.includes('yarn')) return 'yarn';
    if (userAgent.includes('bun')) return 'bun';
    if (userAgent.includes('npm')) return 'npm';
  }

  // Priority 2: Check lock files and package.json by walking up the tree
  const lockFiles: Record<string, PackageManager> = {
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
    'bun.lockb': 'bun',
    'package-lock.json': 'npm',
  };

  let currentDir = path.resolve(directory);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    // Check for lock files in current directory
    for (const [lockFile, manager] of Object.entries(lockFiles)) {
      if (fs.existsSync(path.join(currentDir, lockFile))) {
        return manager;
      }
    }

    // Check packageManager field in package.json
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.packageManager) {
          const packageManager = packageJson.packageManager.toLowerCase();
          if (packageManager.includes('pnpm')) return 'pnpm';
          if (packageManager.includes('yarn')) return 'yarn';
          if (packageManager.includes('bun')) return 'bun';
          if (packageManager.includes('npm')) return 'npm';
        }
      } catch {
        // Continue if package.json is invalid
      }
    }

    // Move up one directory
    currentDir = path.dirname(currentDir);
  }

  // Priority 3: Check for monorepo indicators
  try {
    const possibleMonorepoRoots = [
      directory, // Only check current directory for workspace indicators
    ];

    for (const rootDir of possibleMonorepoRoots) {
      if (
        fs.existsSync(path.join(rootDir, 'pnpm-workspace.yaml')) ||
        (fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml')) && rootDir === directory)
      ) {
        return 'pnpm';
      }
      if (
        fs.existsSync(path.join(rootDir, 'lerna.json')) ||
        (fs.existsSync(path.join(rootDir, 'yarn.lock')) && rootDir === directory)
      ) {
        return 'yarn';
      }
    }
  } catch {
    // Continue with fallback
  }

  return 'npm'; // default fallback
}

/** Check if a package is already installed */
export function isPackageInstalled(
  packageName: string,
  directory: string = process.cwd()
): boolean {
  const packageJsonPath = path.join(directory, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return !!(
      (packageJson.dependencies && packageJson.dependencies[packageName]) ||
      (packageJson.devDependencies && packageJson.devDependencies[packageName])
    );
  } catch {
    return false;
  }
}

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

function parseVersion(value: string): ParsedVersion | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareVersions(left: ParsedVersion, right: ParsedVersion): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch;
}

export function isVersionAtLeast(version: string, minimumVersion: string): boolean {
  const parsedVersion = parseVersion(version);
  const parsedMinimum = parseVersion(minimumVersion);
  return Boolean(
    parsedVersion && parsedMinimum && compareVersions(parsedVersion, parsedMinimum) >= 0
  );
}

export function isVersionCompatible(
  version: string,
  minimumVersion: string,
  maximumVersionExclusive?: string
): boolean {
  if (!isVersionAtLeast(version, minimumVersion)) return false;
  if (!maximumVersionExclusive) return true;
  const parsedVersion = parseVersion(version);
  const parsedMaximum = parseVersion(maximumVersionExclusive);
  return Boolean(
    parsedVersion && parsedMaximum && compareVersions(parsedVersion, parsedMaximum) < 0
  );
}

export function isSafelyConstrainedVersion(
  declaration: string,
  minimumVersion: string,
  maximumVersionExclusive?: string
): boolean {
  const value = declaration.trim();
  const exactOrPrefixed = /^([~^]?)(\d+\.\d+\.\d+)$/.exec(value);
  if (exactOrPrefixed) {
    const prefix = exactOrPrefixed[1];
    const version = exactOrPrefixed[2]!;
    if (!isVersionCompatible(version, minimumVersion, maximumVersionExclusive)) {
      return false;
    }
    if (!maximumVersionExclusive || prefix !== '^') return true;
    const parsedVersion = parseVersion(version)!;
    const parsedMaximum = parseVersion(maximumVersionExclusive)!;
    return parsedVersion.major + 1 <= parsedMaximum.major;
  }

  const comparatorRange = /^>=(\d+\.\d+\.\d+)(?:\s+(<|<=)(\d+\.\d+\.\d+))?$/.exec(value);
  if (!comparatorRange || !isVersionAtLeast(comparatorRange[1]!, minimumVersion)) {
    return false;
  }
  if (!maximumVersionExclusive) return true;
  if (!comparatorRange[2] || !comparatorRange[3]) return false;
  const upper = parseVersion(comparatorRange[3])!;
  const maximum = parseVersion(maximumVersionExclusive)!;
  const comparison = compareVersions(upper, maximum);
  return comparison < 0 || (comparison === 0 && comparatorRange[2] === '<');
}

export function getDeclaredPackageVersion(
  packageName: string,
  directory: string
): string | undefined {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(directory, 'package.json'), 'utf8')
    );
    return (
      packageJson.dependencies?.[packageName] ??
      packageJson.devDependencies?.[packageName]
    );
  } catch {
    return undefined;
  }
}

export function getResolvedPackageVersion(
  packageName: string,
  directory: string
): string | undefined {
  try {
    let currentDirectory = path.resolve(directory);
    while (true) {
      const candidate = path.join(
        currentDirectory,
        'node_modules',
        ...packageName.split('/'),
        'package.json'
      );
      if (fs.existsSync(candidate)) {
        const packageJson = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        return typeof packageJson.version === 'string' ? packageJson.version : undefined;
      }
      const parentDirectory = path.dirname(currentDirectory);
      if (parentDirectory === currentDirectory) break;
      currentDirectory = parentDirectory;
    }

    const runtimeRequire = createRequire(path.join(directory, 'package.json'));
    const packageJsonPath = runtimeRequire.resolve(`${packageName}/package.json`);
    currentDirectory = path.resolve(directory);
    let belongsToProject = false;
    while (true) {
      if (
        fs.existsSync(path.join(currentDirectory, 'package.json')) &&
        packageJsonPath.startsWith(`${currentDirectory}${path.sep}`)
      ) {
        belongsToProject = true;
        break;
      }
      const parentDirectory = path.dirname(currentDirectory);
      if (parentDirectory === currentDirectory) break;
      currentDirectory = parentDirectory;
    }
    if (!belongsToProject) return undefined;
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    return typeof packageJson.version === 'string' ? packageJson.version : undefined;
  } catch {
    return undefined;
  }
}

export function isPackageRequirementSatisfied(
  packageName: string,
  directory: string,
  minimumVersion?: string
): boolean {
  const declaration = getDeclaredPackageVersion(packageName, directory);
  if (!minimumVersion) {
    return declaration !== undefined;
  }
  const resolvedVersion = getResolvedPackageVersion(packageName, directory);
  if (resolvedVersion) {
    return isVersionAtLeast(resolvedVersion, minimumVersion);
  }
  return Boolean(declaration && isSafelyConstrainedVersion(declaration, minimumVersion));
}

/** Build an add command for one or more packages */
export function buildAddCommand(
  packageManager: PackageManager,
  packageNames: string[],
  isDev = true
): string {
  if (packageNames.length === 0) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error('No packages specified');
  }

  const packageArgs = packageNames.join(' ');
  const commands: Record<PackageManager, string> = {
    npm: `npm install ${isDev ? '--save-dev' : '--save'} ${packageArgs}`,
    yarn: `yarn add ${isDev ? '--dev' : ''} ${packageArgs}`.trim(),
    pnpm: `pnpm add ${isDev ? '--save-dev' : '--save-prod'} ${packageArgs}`,
    bun: `bun add ${isDev ? '--dev' : ''} ${packageArgs}`.trim(),
  };

  const command = commands[packageManager];
  if (!command) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(`Unsupported package manager: ${packageManager}`);
  }

  return command;
}

/** Build an install command for the current package manager */
export function buildInstallCommand(packageManager: PackageManager): string {
  const commands: Record<PackageManager, string> = {
    npm: 'npm install',
    yarn: 'yarn install',
    pnpm: 'pnpm install',
    bun: 'bun install',
  };

  const command = commands[packageManager];
  if (!command) {
    // eslint-disable-next-line no-restricted-syntax
    throw new Error(`Unsupported package manager: ${packageManager}`);
  }

  return command;
}

/** Install multiple packages using the detected package manager */
export function installPackages(
  directory: string,
  packageNames: string[],
  packageManager: PackageManager,
  isDev = true
): boolean {
  if (packageNames.length === 0) {
    return true;
  }

  const command = buildAddCommand(packageManager, packageNames, isDev);
  console.log(`Running: ${command}`);

  try {
    execSync(command, {
      cwd: directory,
      stdio: 'inherit',
      timeout: 120000, // 2 minute timeout for slow networks
    });
    return true;
  } catch (error) {
    console.error(
      `Failed to install ${packageNames.join(', ')}: ${(error as Error).message}`
    );
    return false;
  }
}

/** Install a package using the detected package manager */
export function installPackage(
  directory: string,
  packageName: string,
  packageManager: PackageManager,
  isDev = true
): boolean {
  return installPackages(directory, [packageName], packageManager, isDev);
}

/** Install dependencies from package.json exactly once */
export function installDependencies(
  directory: string,
  packageManager: PackageManager
): boolean {
  const command = buildInstallCommand(packageManager);
  console.log(`Running: ${command}`);

  try {
    execSync(command, {
      cwd: directory,
      stdio: 'inherit',
      timeout: 120000, // 2 minute timeout for slow networks
    });
    return true;
  } catch (error) {
    console.error(`Failed to run ${command}: ${(error as Error).message}`);
    return false;
  }
}

/** Get the latest version of a package from npm */
export function getLatestVersion(packageName: string): string {
  try {
    const result = execSync(`npm view ${packageName} version`, {
      encoding: 'utf8',
      timeout: 10000,
    });
    return result.trim();
  } catch {
    console.warn(`Could not fetch latest version for ${packageName}`);
    return 'latest';
  }
}

/** Add package to package.json without installing */
export function addToPackageJson(
  directory: string,
  packageName: string,
  version = 'latest',
  isDev = true
): boolean {
  const packageJsonPath = path.join(directory, 'package.json');
  if (!fs.existsSync(packageJsonPath)) {
    return false;
  }

  try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    const depType = isDev ? 'devDependencies' : 'dependencies';
    if (!packageJson[depType]) {
      packageJson[depType] = {};
    }

    packageJson[depType][packageName] = /^[~^<>=*]|\s|\|\|/.test(version)
      ? version
      : `^${version}`;

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    return true;
  } catch (error) {
    console.error(`Failed to update package.json: ${(error as Error).message}`);
    return false;
  }
}
