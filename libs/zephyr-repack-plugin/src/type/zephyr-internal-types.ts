import { Configuration, Context } from '@rspack/core';

export interface DelegateConfig {
  org: string;
  project: string;
  application?: undefined;
  target?: 'ios' | 'android' | 'web' | undefined;
}

export type Platform = DelegateConfig['target'];

export interface RepackEnv {
  context?: Context;
  // location of react native package in node_modules
  reactNativePath?: string;
  // 'development' | 'production' | undefined
  mode?: 'development' | 'production' | undefined;
  devServer?: {
    port?: number;
    host?: string;
    https?: boolean;
    hmr?: boolean;
  };
  // 'ios' | 'android' | 'web' | undefined
  platform?: Platform | undefined;
}

export type RePackConfiguration = Configuration & RepackEnv;
