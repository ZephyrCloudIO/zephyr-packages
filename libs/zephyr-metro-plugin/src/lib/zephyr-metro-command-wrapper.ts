import { ZephyrError, ZeErrors, type Platform } from 'zephyr-agent';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { ERR_MISSING_METRO_FEDERATION_CONFIG } from './internal/metro-errors';
import { ZephyrMetroPlugin } from './zephyr-metro-plugin';

export type MetroConfig = Record<string, unknown>;
export type MetroFederationConfig = Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];

interface MetroBundleOptions {
  mode: string;
  platform: Platform;
}

interface MetroConfigOptions extends MetroConfig {
  root: string;
}

interface MetroCliOptions {
  maxWorkers?: number;
  resetCache?: boolean;
  config?: string;
}

type MetroCommandArgs = [[MetroBundleOptions], MetroConfigOptions, MetroCliOptions];

export async function zephyrCommandWrapper(
  bundleFederatedRemote: (...args: MetroCommandArgs) => Promise<any>,
  loadMetroConfig: (config: MetroConfig, options: MetroCliOptions) => Promise<any>,
  updateManifest: () => void
) {
  return async (...args: MetroCommandArgs) => {
    try {
      // before build
      const isDev = args[0][0].mode;
      const platform = args[0][0].platform;

      const context = args[1].root;

      await loadMetroConfig(args[1], {
        maxWorkers: args[2].maxWorkers,
        resetCache: args[2].resetCache,
        config: args[2].config,
      });

      if (!(global as any).__METRO_FEDERATION_CONFIG) {
        throw new ZephyrError(ERR_MISSING_METRO_FEDERATION_CONFIG);
      }

      const zephyrMetroPlugin = new ZephyrMetroPlugin({
        platform,
        mode: isDev ? 'development' : 'production',
        context,
        outDir: 'dist',
        mfConfig: (global as any).__METRO_FEDERATION_CONFIG,
      });

      await zephyrMetroPlugin.beforeBuild();

      updateManifest();

      const res = await bundleFederatedRemote(...args);

      await zephyrMetroPlugin.afterBuild();

      return res;
    } catch (error) {
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: JSON.stringify(error),
      });
    }
  };
}
