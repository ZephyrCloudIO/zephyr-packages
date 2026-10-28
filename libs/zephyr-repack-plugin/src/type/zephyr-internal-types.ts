import type { Context } from '@rspack/core';
import type { NativeBuildTarget } from 'zephyr-native-internal';
export interface DelegateConfig {
  org: string;
  project: string;
  application?: undefined;
  target?: NativeBuildTarget;
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
  platform: NativeBuildTarget | undefined;
}
