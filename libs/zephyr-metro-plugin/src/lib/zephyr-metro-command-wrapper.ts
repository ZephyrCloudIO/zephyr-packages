import {
  collectZEPublicVars,
  isZephyrDisabled,
  logZephyrDisabled,
  ZephyrError,
  ZeErrors,
  ze_log,
} from 'zephyr-agent';
import type { ZephyrPluginOptions } from 'zephyr-edge-contract';
import { ERR_MISSING_METRO_FEDERATION_CONFIG } from './internal/metro-errors';
import { assertNativeBuildTarget, type NativeBuildTarget } from 'zephyr-native-internal';
import { ZephyrMetroPlugin } from './zephyr-metro-plugin';

export type MetroConfig = Record<string, unknown>;
export type MetroFederationConfig = Pick<ZephyrPluginOptions, 'mfConfig'>['mfConfig'];

interface MetroBundleOptions {
  dev?: boolean;
  mode?: string | boolean;
  platform: NativeBuildTarget;
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

/** Warns about Metro setups that cannot deliver environment overrides on device. */
function warnNativeEnvSetup(): void {
  if (
    !global.__ZEPHYR_METRO_ENV_REWRITE__ &&
    Object.keys(collectZEPublicVars(process.env)).length > 0
  ) {
    ze_log.app(
      'Zephyr native env: metro.config.js does not use withZephyr; ZE_PUBLIC_* reads are not rewritten and cannot receive environment overrides'
    );
  }
}

/**
 * Runs `bundle` while every Module Federation options object MF Metro publishes on
 * `global.__METRO_FEDERATION_CONFIG` receives Zephyr's overrides. MF's bundle commands
 * reload the Metro config; for function-exported configs that rebuilds the options object
 * its runtime modules are generated from, after `beforeBuild` already ran.
 */
async function withFederationOverrides<T>(
  plugin: ZephyrMetroPlugin,
  bundle: () => Promise<T>
): Promise<T> {
  let current = global.__METRO_FEDERATION_CONFIG;
  Object.defineProperty(globalThis, '__METRO_FEDERATION_CONFIG', {
    configurable: true,
    enumerable: true,
    get: () => current,
    set: (next: typeof current) => {
      plugin.applyToFederationConfig(next);
      current = next;
    },
  });
  try {
    return await bundle();
  } finally {
    Object.defineProperty(globalThis, '__METRO_FEDERATION_CONFIG', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: current,
    });
  }
}

export async function zephyrCommandWrapper(
  bundleFederatedRemote: (...args: MetroCommandArgs) => Promise<any>,
  loadMetroConfig: (config: MetroConfig, options: MetroCliOptions) => Promise<any>,
  updateManifest: () => void
) {
  return async (...args: MetroCommandArgs) => {
    const platform = args[0][0].platform;

    // Keep this outside the error wrapper: an unsupported platform must stop
    // before Metro config loading, dependency resolution, or asset publication.
    assertNativeBuildTarget(platform, 'Metro bundle platform', 'metro');

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

      // Skip mode: bundle as Metro would without Zephyr. No engine, no token, no git
      // information, no remote resolution, no upload.
      if (isZephyrDisabled()) {
        if ((global as any).__METRO_FEDERATION_CONFIG) {
          updateManifest();
        }
        const res = await bundleFederatedRemote(...args);
        logZephyrDisabled();
        return res;
      }

      if (!(global as any).__METRO_FEDERATION_CONFIG) {
        throw new ZephyrError(ERR_MISSING_METRO_FEDERATION_CONFIG);
      }
      warnNativeEnvSetup();

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

      const res = await withFederationOverrides(zephyrMetroPlugin, () =>
        bundleFederatedRemote(...args)
      );

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
