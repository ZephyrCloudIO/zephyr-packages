import type { ZephyrDependency } from './zephyr-build-stats';

export interface ZephyrManifest {
  version: number;
  timestamp: string;
  dependencies: Record<string, ZephyrDependency>;
}
