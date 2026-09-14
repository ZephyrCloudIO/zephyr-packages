import { ZephyrError, ZeErrors } from 'zephyr-agent';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { ERR_MISSING_METRO_FEDERATION_CONFIG } from './internal/metro-errors';
import {
  assertMetroNativeBuildTarget,
  type MetroNativeBuildTarget,
} from './native-target';
import { ZephyrMetroPlugin } from './zephyr-metro-plugin';

export type MetroConfig = Record<string, unknown>;
export type MetroFederationConfig = Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];

interface MetroBundleOptions {
  dev?: boolean;
  mode?: string | boolean;
  platform: MetroNativeBuildTarget;
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
    const platform = args[0][0].platform;

    // Keep this outside the error wrapper: an unsupported platform must stop
    // before Metro config loading, dependency resolution, or asset publication.
    assertMetroNativeBuildTarget(platform, 'Metro bundle platform');

    let zephyrMetroPlugin: ZephyrMetroPlugin | undefined;
    let wrapperOwnsRollback = false;
    try {
      // before build
      const requestedDev = args[0][0].dev;
      const requestedMode = args[0][0].mode;
      const mode =
        typeof requestedDev === 'boolean'
          ? requestedDev
            ? 'development'
            : 'production'
          : requestedMode === 'production'
            ? 'production'
            : requestedMode === 'development' || Boolean(requestedMode)
              ? 'development'
              : 'production';

      const context = args[1].root;

      await loadMetroConfig(args[1], {
        maxWorkers: args[2].maxWorkers,
        resetCache: args[2].resetCache,
        config: args[2].config,
      });

      if (!(global as any).__METRO_FEDERATION_CONFIG) {
        throw new ZephyrError(ERR_MISSING_METRO_FEDERATION_CONFIG);
      }

      zephyrMetroPlugin = new ZephyrMetroPlugin({
        platform,
        mode,
        context,
        outDir: 'dist',
        mfConfig: (global as any).__METRO_FEDERATION_CONFIG,
      });

      await zephyrMetroPlugin.beforeBuild();
      wrapperOwnsRollback = true;

      updateManifest();

      const res = await bundleFederatedRemote(...args);

      // afterBuild owns rollback from this point onward.
      wrapperOwnsRollback = false;
      await zephyrMetroPlugin.afterBuild();

      return res;
    } catch (error) {
      if (
        wrapperOwnsRollback &&
        zephyrMetroPlugin?.zephyr_engine.hasActiveBuild !== false
      ) {
        zephyrMetroPlugin?.zephyr_engine.build_failed();
      }
      const detail =
        error instanceof Error
          ? `${error.message}\n${error.stack ?? ''}`
          : typeof error === 'string'
            ? error
            : JSON.stringify(error, Object.getOwnPropertyNames(error as object));
      throw new ZephyrError(ZeErrors.ERR_UNKNOWN, {
        message: detail,
      });
    }
  };
}
