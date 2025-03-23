import { Configuration } from '@rspack/core';
import { EnvOptions as RepackEnvOptions } from '@callstack/repack';
export interface DelegateConfig {
  org: string;
  project: string;
  application?: undefined;
  target?: 'ios' | 'android' | 'web' | undefined;
}

export type Platform = DelegateConfig['target'];

export type RePackConfiguration = Configuration & RepackEnvOptions;
