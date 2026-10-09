import type { ZephyrDependency } from './zephyr-build-stats';

export const ZEPHYR_MANIFEST_VERSION = '1.0.0';
export const ZEPHYR_MANIFEST_FILENAME = 'zephyr-manifest.json';
export const ZEPHYR_MANIFEST_META_NAME = 'zephyr-manifest';
export const ZEPHYR_MANIFEST_HASH_REGEXP = /^[0-9a-f]{64}$/;

export function isZephyrManifestHash(hash: string): boolean {
  return ZEPHYR_MANIFEST_HASH_REGEXP.test(hash);
}

export function getHashedZephyrManifestFilename(hash: string): string {
  if (!isZephyrManifestHash(hash)) {
    throw new TypeError(`Invalid Zephyr manifest hash: ${hash}`);
  }

  return `zephyr-manifest.${hash}.json`;
}

export function getHashedZephyrManifestPath(hash: string): string {
  return `/${getHashedZephyrManifestFilename(hash)}`;
}

export interface ZephyrManifest {
  version: string;
  timestamp: string;
  dependencies: Record<string, ZephyrDependency>;
  zeVars: Record<string, string>;
}
