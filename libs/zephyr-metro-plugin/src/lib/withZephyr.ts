import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { ZephyrMetroPlugin } from './zephyr-metro-plugin';

export interface ModuleFederationConfig {
  name: string;
  remotes?: Record<string, string>;
  shared?: Record<
    string,
    {
      singleton?: boolean;
      eager?: boolean;
      requiredVersion?: string;
      version?: string;
    }
  >;
  shareStrategy?: 'loaded-first' | 'version-first';
  plugins?: string[];
}

export function withZephyr(
  context?: string,
  platform: 'ios' | 'android' = 'ios',
  mode: 'development' | 'production' = 'development',
  outDir = 'dist'
): (
  config: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig']
) => Promise<Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig']> {
  return async function (config: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig']) {
    if (!config) return config;

    const zephyrMetroPlugin = new ZephyrMetroPlugin({
      platform,
      mode,
      context: context || process.cwd(),
      outDir,
      mfConfig: config,
    });

    const newConfig = await zephyrMetroPlugin.beforeBuild();

    return newConfig;
  };
}
