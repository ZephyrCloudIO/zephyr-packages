import type { Context } from '@rspack/core';
import type { RepackNativeBuildTarget } from '../lib/native-target';
export interface DelegateConfig {
  org: string;
  project: string;
  application?: undefined;
  target?: RepackNativeBuildTarget;
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
  // Re.Pack is a React Native adapter, so generic browser/TAP targets are unsupported.
  platform: RepackNativeBuildTarget | undefined;
}
