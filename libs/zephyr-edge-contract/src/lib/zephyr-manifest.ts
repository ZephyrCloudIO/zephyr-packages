import type { ZephyrDependency } from './zephyr-build-stats';

export const ZEPHYR_MANIFEST_VERSION = '1.0.0';

/** Changes to this interface should be semanticaly reflect on the const above; */
export interface ZephyrManifest {
  version: typeof ZEPHYR_MANIFEST_VERSION;
  timestamp: string;
  dependencies: Record<string, ZephyrDependency>;
}
