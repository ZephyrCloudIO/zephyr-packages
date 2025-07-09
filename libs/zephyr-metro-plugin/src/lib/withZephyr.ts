import { ZephyrPluginOptions } from 'zephyr-edge-contract';
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
  context?: string
): (
  config: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig']
) => Promise<Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig']> {
  return async function (config: Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig']) {
    if (!config) return config;

    const zephyrMetroPlugin = new ZephyrMetroPlugin({
      platform: 'ios',
      mode: 'development',
      context: context || process.cwd(),
      outDir: 'dist',
      mfConfig: config,
    });

    const newConfig = await zephyrMetroPlugin.beforeBuild();

    return newConfig;
  };
}
