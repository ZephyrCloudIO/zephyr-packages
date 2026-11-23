import { realpath } from 'node:fs/promises';
import { isAbsolute, relative, sep } from 'node:path';
import {
  buildAssetsMap,
  logFn,
  readDirRecursiveWithContents,
  type ZeBuildAssetsMap,
} from 'zephyr-agent';
import type { ZephyrBuildTarget } from 'zephyr-edge-contract';
import { assertCompiledOutput, assertNoUnconfiguredWorkerConfig } from './upload-guards';
import { selectFiles, type ExcludedFile, type SelectionInput } from './file-selection';

interface DirectoryAsset {
  content: Buffer | string;
  type: string;
}

export interface ExtractAssetsFromDirectoryOptions {
  /** TAP packages publish their complete SDK-locked output without web-app filters. */
  target?: ZephyrBuildTarget;
  /** Globs, relative to the directory, that select the files to upload. */
  include?: readonly string[];
  /** Globs, relative to the directory, that remove files from the included set. */
  exclude?: readonly string[];
  /**
   * Deploy only: refuse a folder holding a Wrangler config when no zephyr.config.json is
   * in effect. `run` and `watch` leave it unset, because worker bundlers may emit a
   * wrangler.json into their normal output.
   */
  workerConfigGuard?: { hasConfig: boolean };
}

export interface SelectedFile {
  path: string;
  content: Buffer | string;
  size: number;
}

export interface DirectorySelection {
  files: SelectedFile[];
  excluded: ExcludedFile[];
}

function extractBuffer(asset: DirectoryAsset): Buffer | string | undefined {
  return asset.content;
}

function getAssetType(asset: DirectoryAsset): string {
  return asset.type;
}

/** Normalize path separators to forward slashes for cross-platform consistency */
function normalizePath(filePath: string): string {
  return filePath.split(sep).join('/');
}

async function resolveInput(
  rootReal: string,
  path: string,
  fullPath: string
): Promise<SelectionInput> {
  let real: string;
  try {
    real = await realpath(fullPath);
  } catch {
    // Fail closed: a path that cannot be resolved cannot be proven to be inside.
    return { path, outsideRoot: true };
  }
  const fromRoot = relative(rootReal, real);
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    return { path, outsideRoot: true };
  }
  return { path, realPath: normalizePath(fromRoot) };
}

/** One warning per file that the never-upload rules or symlink containment removed. */
export function warnAboutBlockedFiles(excluded: readonly ExcludedFile[]): void {
  for (const file of excluded) {
    if (file.reason === 'denylist') {
      logFn(
        'warn',
        `Not uploading ${file.path}: it matches the never-upload rule "${file.rule}".`
      );
    } else if (file.reason === 'outside-root') {
      logFn(
        'warn',
        `Not uploading ${file.path}: it is a symbolic link that leads outside the upload folder.`
      );
    }
  }
}

/**
 * Walks a directory and applies the shared file selection. Upload, dry run, `run` and
 * `watch` all go through here, so the secret denylist protects every path and a dry run
 * lists exactly what an upload sends.
 */
export async function selectDirectoryFiles(
  buildDir: string,
  options: ExtractAssetsFromDirectoryOptions = {}
): Promise<DirectorySelection> {
  const preservesLockedArtifacts = options.target === 'tap-app';
  // With an include list the config decides, not the agent's skip list. The denylist
  // still blocks `.git` and `node_modules`.
  const hasInclude = options.include !== undefined;

  let read: Awaited<ReturnType<typeof readDirRecursiveWithContents>>;
  try {
    read = await readDirRecursiveWithContents(buildDir, {
      includeIgnoredPaths: preservesLockedArtifacts || hasInclude,
      failOnError: preservesLockedArtifacts,
    });
  } catch (error) {
    if (options.target === 'tap-app') {
      throw error;
    }
    logFn('warn', `Failed to read build directory ${buildDir}: ${error}`);
    return { files: [], excluded: [] };
  }

  // Resolve every symlink: a link inside the folder must not carry content from outside
  // it, and a link to a credential file is judged by where it really points.
  let rootReal: string;
  try {
    rootReal = await realpath(buildDir);
  } catch {
    return { files: [], excluded: [] };
  }
  const byPath = new Map<string, Buffer>();
  const inputs: SelectionInput[] = [];
  for (const file of read) {
    const path = normalizePath(file.relativePath);
    byPath.set(path, file.content);
    inputs.push(await resolveInput(rootReal, path, file.fullPath));
  }

  // The guards sit outside the read's warn-and-continue handling: a refusal must stop
  // the upload, and the dry run hits the same refusal.
  if (options.workerConfigGuard !== undefined) {
    assertNoUnconfiguredWorkerConfig(
      [...byPath.keys()],
      options.workerConfigGuard.hasConfig
    );
  }
  const { selected, excluded } = selectFiles(inputs, options);
  const files: SelectedFile[] = selected.map((path) => {
    const content = byPath.get(path) ?? '';
    return { path, content, size: Buffer.byteLength(content) };
  });
  assertCompiledOutput(files, options.target);
  return { files, excluded };
}

/** Builds the upload assets map from an already selected set of files. */
export function buildAssetsMapFromSelection(
  files: readonly SelectedFile[]
): ZeBuildAssetsMap {
  const assets: Record<string, DirectoryAsset> = {};
  for (const file of files) {
    assets[file.path] = { content: file.content, type: getFileType(file.path) };
  }
  return buildAssetsMap(assets, extractBuffer, getAssetType);
}

/** Extract assets map from a directory by recursively walking through it. */
export async function extractAssetsFromDirectory(
  buildDir: string,
  options: ExtractAssetsFromDirectoryOptions = {}
): Promise<ZeBuildAssetsMap> {
  const { files, excluded } = await selectDirectoryFiles(buildDir, options);
  warnAboutBlockedFiles(excluded);
  return buildAssetsMapFromSelection(files);
}

function getFileType(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase() ?? '';

  const typeMap: Record<string, string> = {
    html: 'text/html',
    css: 'text/css',
    js: 'application/javascript',
    mjs: 'application/javascript',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    eot: 'application/vnd.ms-fontobject',
    xml: 'text/xml',
    txt: 'text/plain',
  };

  return typeMap[extension] || 'application/octet-stream';
}
