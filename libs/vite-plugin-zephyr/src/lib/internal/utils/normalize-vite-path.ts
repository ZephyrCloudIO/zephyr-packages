import { sep } from 'node:path';

/** Normalize emitted paths without importing Vite's ESM-only runtime. */
export function normalizeVitePath(pathname: string): string {
  return pathname.replace(/\\/g, '/');
}

/**
 * Filesystem walkers return paths using the host separator. Keep that portable
 * normalization separate from logical Rollup/Vite bundle keys: on POSIX, a backslash in a
 * bundle key is an alias character rather than a native separator and TAP must reject it
 * instead of silently changing a descriptor-locked path.
 */
export function normalizeFilesystemVitePath(pathname: string): string {
  return pathname.split(sep).join('/');
}
