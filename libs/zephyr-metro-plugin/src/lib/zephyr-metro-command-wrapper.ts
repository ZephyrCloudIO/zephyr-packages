import { ZeErrors, ZephyrError } from 'zephyr-agent';
import { ZephyrMetroPlugin } from './zephyr-metro-plugin';

export type MetroConfig = Record<string, unknown>;
export type MetroFederationConfig = Record<string, unknown>; // TODO: Import proper MF config type

export async function zephyrCommandWrapper(
  bundleFederatedRemote: (...args: any[]) => Promise<any>,
  loadMetroConfig: (
    config: MetroConfig,
    options: { maxWorkers?: number; resetCache?: boolean; config?: string }
  ) => Promise<any>,
  updateManifest: () => void
) {
  return async (...args: any[]) => {
    try {
      // before build
      const isDev = args[0][0]['mode'];
      const platform = args[0][0]['platform'];

      const context = args[1].root;

      await loadMetroConfig(args[1], {
        maxWorkers: args[2].maxWorkers,
        resetCache: args[2].resetCache,
        config: args[2].config,
      });

      if (!(global as any).__METRO_FEDERATION_CONFIG) {
        throw new ZephyrError(ZeErrors.ERR_MISSING_METRO_FEDERATION_CONFIG);
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
