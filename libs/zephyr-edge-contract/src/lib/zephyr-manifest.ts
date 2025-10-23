import type { ZephyrDependency } from './zephyr-build-stats';

export const ZEPHYR_MANIFEST_VERSION = '1.0.0';
export const ZEPHYR_MANIFEST_FILENAME = 'zephyr-manifest.json';

export interface ZephyrManifest {
  version: string;
  timestamp: string;
  dependencies: Record<string, ZephyrDependency>;
  zeVars: Record<string, string>;
}
