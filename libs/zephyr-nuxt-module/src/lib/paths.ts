import { access } from 'node:fs/promises';
import { isAbsolute, join, posix, relative, resolve, sep } from 'node:path';

const ENTRYPOINT_CANDIDATES = ['server/index.mjs', 'server/index.js', 'server/index.cjs'];

export function normalizePath(value: string): string {
  return value.split(sep).join(posix.sep);
}

export function resolveDir(rootDir: string, dir?: string): string | undefined {
  if (!dir) return undefined;
  return isAbsolute(dir) ? dir : resolve(rootDir, dir);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeEntrypoint(entrypoint: string, outputDir: string): string {
  let normalized = entrypoint.trim();

  if (isAbsolute(normalized)) {
    normalized = relative(outputDir, normalized);
  }

  normalized = normalizePath(normalized);

  while (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }

  while (normalized.startsWith('/')) {
    normalized = normalized.slice(1);
  }

  const outputPosix = normalizePath(outputDir);
  if (normalized.startsWith(outputPosix)) {
    normalized = normalized.slice(outputPosix.length);
    normalized = normalized.replace(/^\/+/, '');
  }

  return normalized;
}

export async function resolveEntrypoint(
  outputDir: string,
  entrypoint?: string
): Promise<string | undefined> {
  if (entrypoint) {
    return normalizeEntrypoint(entrypoint, outputDir);
  }

  for (const candidate of ENTRYPOINT_CANDIDATES) {
    const candidatePath = join(outputDir, candidate);
    if (await fileExists(candidatePath)) {
      return normalizeEntrypoint(candidate, outputDir);
    }
  }

  return undefined;
}

export function resolveOutputDir(
  rootDir: string,
  outputDir?: string,
  fallback?: string
): string {
  const candidate = outputDir || fallback || '.output';
  return isAbsolute(candidate) ? candidate : resolve(rootDir, candidate);
}
