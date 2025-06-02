import type { Context } from '@rspack/core';
import type { Platform } from 'zephyr-agent';
export interface DelegateConfig {
  org: string;
  project: string;
  application?: undefined;
  target?: Platform;
}

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
  platform: Platform | undefined;
}
