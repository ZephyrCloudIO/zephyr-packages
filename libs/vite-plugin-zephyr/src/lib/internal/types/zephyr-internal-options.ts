import type { ZephyrBuildTarget } from 'zephyr-agent';
import type { ZephyrOutputBundle } from './zephyr-output';

export interface ZephyrInternalOptions {
  root: string;
  outDir: string;
  /** Artifact family determines whether filesystem reads must preserve ignored paths. */
  target?: ZephyrBuildTarget;
  configFile?: string;
  publicDir?: string;
  dir?: string;
  assets?: ZephyrOutputBundle;
}
