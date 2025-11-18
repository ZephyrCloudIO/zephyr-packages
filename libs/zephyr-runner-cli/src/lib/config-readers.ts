import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface PackageJsonConfig {
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

export interface TsConfigJson {
  compilerOptions?: {
    outDir?: string;
    rootDir?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/**
 * Read and parse package.json from the given directory
 */
export function readPackageJson(cwd: string): PackageJsonConfig | null {
  const packageJsonPath = join(cwd, 'package.json');

  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const content = readFileSync(packageJsonPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Read and parse tsconfig.json from the given directory
 */
export function readTsConfig(cwd: string, configPath = 'tsconfig.json'): TsConfigJson | null {
  const tsConfigPath = join(cwd, configPath);

  if (!existsSync(tsConfigPath)) {
    return null;
  }

  try {
    const content = readFileSync(tsConfigPath, 'utf-8');
    // Simple JSON parse - doesn't handle comments or extends properly
    // but good enough for basic cases
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Check if a file exists and has a .js or .mjs extension
 */
export function isJavaScriptConfig(cwd: string, baseName: string): boolean {
  const jsExtensions = ['.js', '.mjs', '.cjs'];

  for (const ext of jsExtensions) {
    const configPath = join(cwd, `${baseName}${ext}`);
    if (existsSync(configPath)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a configuration file exists (any extension)
 */
export function configFileExists(cwd: string, baseName: string): string | null {
  const extensions = ['.json', '.js', '.mjs', '.cjs', '.ts'];

  for (const ext of extensions) {
    const configPath = join(cwd, `${baseName}${ext}`);
    if (existsSync(configPath)) {
      return configPath;
    }
  }

  return null;
}
