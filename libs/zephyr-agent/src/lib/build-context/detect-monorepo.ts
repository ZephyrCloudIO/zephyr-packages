import { accessSync, constants } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ze_log } from '../logging/debug';

export type MonorepoType = 'pnpm' | 'yarn' | 'npm' | 'lerna' | 'nx' | 'rush' | 'none';

export interface MonorepoInfo {
  type: MonorepoType;
  root: string;
  configFile?: string;
  workspaces?: string[];
}

type MonorepoConfigFile = {
  file: string;
  type: Exclude<MonorepoType, 'yarn' | 'npm' | 'none'>;
};

const MONOREPO_CONFIG_FILES: readonly MonorepoConfigFile[] = [
  { file: 'pnpm-workspace.yaml', type: 'pnpm' },
  { file: 'pnpm-workspace.yml', type: 'pnpm' },
  { file: 'lerna.json', type: 'lerna' },
  { file: 'nx.json', type: 'nx' },
  { file: 'rush.json', type: 'rush' },
] as const;

const MAX_TRAVERSAL_DEPTH = 10;

/**
 * Detects if the current project is part of a monorepo and returns information about it.
 * Traverses up the directory tree looking for monorepo configuration files.
 */
export async function detectMonorepo(startPath: string): Promise<MonorepoInfo> {
  let currentDir = resolve(startPath);
  let depth = 0;

  while (depth < MAX_TRAVERSAL_DEPTH) {
    // Check for specific monorepo config files
    for (const config of MONOREPO_CONFIG_FILES) {
      const configPath = join(currentDir, config.file);
      if (fileExists(configPath)) {
        ze_log.misc(`Found ${config.type} monorepo config at ${configPath}`);
        return {
          type: config.type,
          root: currentDir,
          configFile: configPath,
        };
      }
    }

    // Check for package.json with workspaces
    const packageJsonPath = join(currentDir, 'package.json');
    if (fileExists(packageJsonPath)) {
      try {
        const content = await readFile(packageJsonPath, 'utf8');
        const packageJson = JSON.parse(content);

        // Check for npm/yarn workspaces
        if (packageJson.workspaces) {
          ze_log.misc(
            `Found ${packageJson.packageManager?.startsWith('yarn') ? 'yarn' : 'npm'} workspaces at ${packageJsonPath}`
          );
          return {
            type: packageJson.packageManager?.startsWith('yarn') ? 'yarn' : 'npm',
            root: currentDir,
            configFile: packageJsonPath,
            workspaces: Array.isArray(packageJson.workspaces)
              ? packageJson.workspaces
              : packageJson.workspaces.packages || [],
          };
        }

        // Check for .yarnrc.yml in the same directory (Yarn Berry)
        const yarnrcPath = join(currentDir, '.yarnrc.yml');
        if (fileExists(yarnrcPath)) {
          ze_log.misc(`Found Yarn Berry workspace at ${currentDir}`);
          return {
            type: 'yarn',
            root: currentDir,
            configFile: yarnrcPath,
          };
        }
      } catch (error) {
        ze_log.misc(`Error reading package.json at ${packageJsonPath}:`, error);
      }
    }

    // Check if we've reached the root
    const parentDir = resolve(currentDir, '..');
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
    depth++;
  }

  ze_log.misc('No monorepo configuration found');
  return {
    type: 'none',
    root: startPath,
  };
}

/** Gets the root package.json from a monorepo root directory */
export async function getMonorepoRootPackageJson(
  monorepoRoot: string
): Promise<Record<string, unknown> | null> {
  const packageJsonPath = join(monorepoRoot, 'package.json');
  if (!fileExists(packageJsonPath)) {
    return null;
  }

  try {
    const content = await readFile(packageJsonPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    ze_log.misc(`Error reading root package.json at ${packageJsonPath}:`, error);
    return null;
  }
}

function fileExists(path: string): boolean {
  try {
    accessSync(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
