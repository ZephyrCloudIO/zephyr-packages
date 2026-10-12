import * as fs from 'node:fs';
import path from 'node:path';
import { getZephyrConfig } from 'zephyr-agent';
import { ZEPHYR_MCP_PROVIDER_FILENAME } from 'zephyr-edge-contract';

/** The `zephyr-mcp` package whose dependency opts a package directory in. */
export const MCP_PACKAGE_NAME = 'zephyr-mcp';

const ZEPHYR_CONFIG_FILES = [
  'zephyr.config.ts',
  'zephyr.config.mts',
  'zephyr.config.cts',
  'zephyr.config.js',
  'zephyr.config.mjs',
  'zephyr.config.cjs',
] as const;
const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;

export type McpClassification =
  /** Rule 1: `<dir>/mcp-provider.json` exists. */
  | { kind: 'provider-artifact' }
  /** Rules 2 and 3: a `skills/` directory, no tool files. */
  | { kind: 'skills-repo'; hasPackageJson: boolean }
  /** Rule 3: opted-in package with tool files; deploy its built `dist/`. */
  | { kind: 'tools-repo' }
  /** Rule 2: tool files without a package.json; always ZD0732. */
  | { kind: 'tools-without-package-json' }
  /** Rule 4: the unchanged legacy path. */
  | { kind: 'legacy'; publicSkillsDirectory: boolean };

export interface ClassifyMcpDirectoryOptions {
  /**
   * How a `<dir>/zephyr.config.*` opt-in is read. `evaluate` (deploy, run, watch) loads
   * the config exactly as zephyr-agent does, so any expression that resolves to `mcp:
   * true` opts in and the deploy can never fall through to a public web upload. `static`
   * (doctor, which never executes project code) only recognizes a literal `mcp: true`
   * property.
   */
  zephyrConfig?: 'evaluate' | 'static';
}

/** The one classifier shared by deploy, run, watch and doctor (contract section 8.1). */
export async function classifyMcpDirectory(
  directory: string,
  options: ClassifyMcpDirectoryOptions = {}
): Promise<McpClassification> {
  if (await isFile(path.join(directory, ZEPHYR_MCP_PROVIDER_FILENAME))) {
    return { kind: 'provider-artifact' };
  }

  const packageJsonPath = path.join(directory, 'package.json');
  const hasPackageJson = await isFile(packageJsonPath);
  const hasTools = (await listToolFiles(directory)).length > 0;
  const hasSkills = await isDirectory(path.join(directory, 'skills'));

  if (!hasPackageJson) {
    if (hasTools) return { kind: 'tools-without-package-json' };
    if (hasSkills) return { kind: 'skills-repo', hasPackageJson: false };
    return { kind: 'legacy', publicSkillsDirectory: false };
  }

  if (await isOptedIn(directory, packageJsonPath, options.zephyrConfig ?? 'evaluate')) {
    if (hasTools) return { kind: 'tools-repo' };
    if (hasSkills) return { kind: 'skills-repo', hasPackageJson: true };
  }
  return { kind: 'legacy', publicSkillsDirectory: hasSkills };
}

/**
 * Tool files: regular `tools/*.ts` files, excluding `*.d.ts`, `*.test.ts`, `*.spec.ts`
 * and names starting with `_` or `.` (a glob never matches dotfiles). Subdirectories
 * never hold tools. Sorted by file name.
 */
export async function listToolFiles(directory: string): Promise<string[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(path.join(directory, 'tools'), {
      withFileTypes: true,
    });
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isFile() && isToolFileName(entry.name))
    .map((entry) => entry.name)
    .sort(compareCodeUnits);
}

export function isToolFileName(name: string): boolean {
  return (
    !name.startsWith('.') &&
    name.endsWith('.ts') &&
    !name.endsWith('.d.ts') &&
    !name.endsWith('.test.ts') &&
    !name.endsWith('.spec.ts') &&
    !name.startsWith('_')
  );
}

/** Comparison order from the contract: UTF-16 code units, never localeCompare. */
export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

async function isOptedIn(
  directory: string,
  packageJsonPath: string,
  zephyrConfig: 'evaluate' | 'static'
): Promise<boolean> {
  const manifest = await readBoundedJson(packageJsonPath);
  if (manifest && typeof manifest === 'object') {
    const record = manifest as Record<string, unknown>;
    for (const field of DEPENDENCY_FIELDS) {
      const dependencies = record[field];
      if (
        dependencies &&
        typeof dependencies === 'object' &&
        Object.hasOwn(dependencies, MCP_PACKAGE_NAME)
      ) {
        return true;
      }
    }
  }

  if (zephyrConfig === 'evaluate') {
    // Same loader, same file and same validation as the engine; a broken config fails
    // here instead of silently classifying as legacy.
    return getZephyrConfig(directory, { isolated: true }).mcp === true;
  }
  for (const fileName of ZEPHYR_CONFIG_FILES) {
    const configPath = path.join(directory, fileName);
    if (!(await isFile(configPath))) continue;
    const stats = await fs.promises.stat(configPath);
    if (stats.size > MAX_MANIFEST_BYTES) continue;
    const source = stripComments(await fs.promises.readFile(configPath, 'utf8'));
    if (/(?:^|[{,\s])["']?mcp["']?\s*:\s*true\b/.test(source)) return true;
  }
  return false;
}

async function readBoundedJson(filePath: string): Promise<unknown> {
  try {
    const stats = await fs.promises.stat(filePath);
    if (stats.size > MAX_MANIFEST_BYTES) return undefined;
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** True for an existing regular file; false only when the path is missing. */
export async function isFile(filePath: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(filePath)).isFile();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

/** True for an existing directory; false only when the path is missing. */
export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(filePath)).isDirectory();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException).code;
  return code === 'ENOENT' || code === 'ENOTDIR';
}
