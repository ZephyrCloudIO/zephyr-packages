import { OutputBundle } from 'rollup';

export interface ZephyrInternalOptions {
  root: string;
  outDir: string;
  configFile?: string;
  publicDir?: string;
  dir?: string;
  assets?: OutputBundle;
}
