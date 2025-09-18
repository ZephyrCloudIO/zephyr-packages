import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import type { PackageManager } from './types.js';

/** Detect the package manager being used in the project */
export function detectPackageManager(
  directory: string = process.cwd()
): PackageManager {
  // Priority order for lock file detection
  const lockFiles: Record<string, PackageManager> = {
    'pnpm-lock.yaml': 'pnpm',
    'yarn.lock': 'yarn',
    'bun.lockb': 'bun',
    'package-lock.json': 'npm',
  };

  // First, check current directory and walk up the tree
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
        const packageJson = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf8')
        );
        if (packageJson.packageManager) {
          const packageManager = packageJson.packageManager.toLowerCase();
          if (packageManager.includes('pnpm')) return 'pnpm';
          if (packageManager.includes('yarn')) return 'yarn';
          if (packageManager.includes('bun')) return 'bun';
          if (packageManager.includes('npm')) return 'npm';
        }
      } catch (error) {
        // Continue if package.json is invalid
      }
    }

    // Move up one directory
    currentDir = path.dirname(currentDir);
  }

  // Check for global package manager availability and preference
  try {
    // Only check monorepo structure if we haven't found anything in the directory tree
    // and avoid going up too far to prevent test pollution
    const possibleMonorepoRoots = [
      directory, // Only check current directory for workspace indicators
    ];

    for (const rootDir of possibleMonorepoRoots) {
      if (
        fs.existsSync(path.join(rootDir, 'pnpm-workspace.yaml')) ||
        (fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml')) &&
          rootDir === directory)
      ) {
        return 'pnpm';
      }
      if (
        fs.existsSync(path.join(rootDir, 'lerna.json')) ||
        (fs.existsSync(path.join(rootDir, 'yarn.lock')) &&
          rootDir === directory)
      ) {
        return 'yarn';
      }
    }
  } catch (error) {
    // Continue with fallback
  }

  // Environment-based detection (only if we didn't find anything specific to this directory)
  if (process.env.npm_config_user_agent) {
    const userAgent = process.env.npm_config_user_agent.toLowerCase();
    if (userAgent.includes('pnpm')) return 'pnpm';
    if (userAgent.includes('yarn')) return 'yarn';
    if (userAgent.includes('bun')) return 'bun';
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
  } catch (error) {
    return false;
  }
}

/** Install a package using the detected package manager */
export function installPackage(
  directory: string,
  packageName: string,
  packageManager: PackageManager,
  isDev: boolean = true
): boolean {
  const commands: Record<PackageManager, string> = {
    npm: `npm install ${isDev ? '--save-dev' : '--save'} ${packageName}`,
    yarn: `yarn add ${isDev ? '--dev' : ''} ${packageName}`.trim(),
    pnpm: `pnpm add ${isDev ? '--save-dev' : '--save-prod'} ${packageName}`,
    bun: `bun add ${isDev ? '--dev' : ''} ${packageName}`.trim(),
  };

  const command = commands[packageManager];
  if (!command) {
    throw new Error(`Unsupported package manager: ${packageManager}`);
  }

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
      `Failed to install ${packageName}: ${(error as Error).message}`
    );
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
  } catch (error) {
    console.warn(`Could not fetch latest version for ${packageName}`);
    return 'latest';
  }
}

/** Add package to package.json without installing */
export function addToPackageJson(
  directory: string,
  packageName: string,
  version: string = 'latest',
  isDev: boolean = true
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

    packageJson[depType][packageName] = `^${version}`;

    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n'
    );
    return true;
  } catch (error) {
    console.error(`Failed to update package.json: ${(error as Error).message}`);
    return false;
  }
}
