import type { ZephyrOutputBundle } from './zephyr-output';

export interface ZephyrInternalOptions {
  root: string;
  outDir: string;
  configFile?: string;
  publicDir?: string;
  dir?: string;
  assets?: ZephyrOutputBundle;
}
