import { ze_log } from 'zephyr-agent';
import { ZephyrMetroPlugin } from './zephyr-metro-plugin';

export type MetroConfig = any; // TODO: Import proper Metro config type
export type MetroFederationConfig = any; // TODO: Import proper MF config type

export async function zephyrCommandWrapper(
  bundleFederatedRemote: (...args: any[]) => Promise<any>,
  loadMetroConfig: (
    config: MetroConfig,
    options: { maxWorkers?: number; resetCache?: boolean; config?: string }
  ) => Promise<any>,
  updateManifest: () => void
) {
  return async (...args: any[]) => {
    ze_log('zephyrCommandWrapper', args);
    // before build
    const isDev = args[0][0]['mode'];
    const platform = args[0][0]['platform'];

    const context = args[1].root;

    await loadMetroConfig(args[1], {
      maxWorkers: args[2].maxWorkers,
      resetCache: args[2].resetCache,
      config: args[2].config,
    });

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

    zephyrMetroPlugin.afterBuild();

    return res;
  };
}
