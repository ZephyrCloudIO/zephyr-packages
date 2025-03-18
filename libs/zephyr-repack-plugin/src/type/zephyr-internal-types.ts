import { Configuration } from '@rspack/core';

export interface DelegateConfig {
  org: string;
  project: string;
  application?: undefined;
  target?: 'ios' | 'android' | 'web' | undefined;
}

export type Platform = DelegateConfig['target'];

export interface RePackConfiguration extends Configuration {
  platform: Platform;
}
