import type { Configuration } from 'webpack';
import {
  getGlobal,
  handleGlobalError,
  ze_log,
  ZephyrEngine,
  type ZeResolvedDependency,
} from 'zephyr-agent';
import {
  extractFederatedDependencyPairs,
  extractLibraryType,
  coordinateXPackCompilers,
  makeCopyOfModuleFederationOptions,
  mutPathModePublicPath,
  mutWebpackFederatedRemotesConfig,
} from 'zephyr-xpack-internal';
import type { ZephyrWebpackPluginOptions } from '../types';
import type { WebpackConfiguration } from '../types/missing-webpack-types';
import { ZeWebpackPlugin } from './ze-webpack-plugin';

function mergeResolvedDependencies(
  previous: readonly ZeResolvedDependency[],
  current: readonly ZeResolvedDependency[]
): ZeResolvedDependency[] {
  const merged = new Map<string, ZeResolvedDependency>();
  for (const dependency of [...previous, ...current]) {
    merged.set(`${dependency.application_uid}\0${dependency.name}`, dependency);
  }
  return [...merged.values()];
}

export function withZephyr(zephyrPluginOptions?: ZephyrWebpackPluginOptions) {
  return async <T extends Configuration | Configuration[]>(config: T): Promise<T> => {
    // Skip Zephyr execution during Nx graph calculation
    // Nx sets global.NX_GRAPH_CREATION = true during graph creation
    if (getGlobal().NX_GRAPH_CREATION) {
      return config;
    }
    if (!Array.isArray(config)) {
      return (await _zephyr_configuration(config, zephyrPluginOptions)) as T;
    }
    if (config.length === 0) {
      return config;
    }

    const engine = await ZephyrEngine.create({
      builder: 'webpack',
      context: config[0]?.context,
    });
    try {
      const { coordinator, compilers } = coordinateXPackCompilers(engine, config, {
        snapshotType: zephyrPluginOptions?.snapshotType,
        entrypoint: zephyrPluginOptions?.entrypoint,
      });
      for (const [index, item] of config.entries()) {
        await _zephyr_configuration(item as WebpackConfiguration, {
          ...zephyrPluginOptions,
          __engine: engine,
          __coordinator: coordinator,
          __participant: compilers[index]?.participant,
          __assetPrefix: compilers[index]?.assetPrefix,
        });
      }
    } catch (error: unknown) {
      if (engine.hasActiveBuild) engine.build_failed();
      throw error;
    }
    return config;
  };
}

async function _zephyr_configuration(
  config: WebpackConfiguration,
  _zephyrOptions?: ZephyrWebpackPluginOptions
): Promise<Configuration> {
  let zephyr_engine: ZephyrEngine | undefined;
  try {
    // create instance of ZephyrEngine to track the application
    zephyr_engine =
      _zephyrOptions?.__engine ??
      (await ZephyrEngine.create({
        builder: 'webpack',
        context: config.context,
      }));

    // Resolve dependencies and update the config
    const dependencyPairs = extractFederatedDependencyPairs(config);
    const previousDependencies = zephyr_engine.federated_dependencies ?? [];
    const resolved_dependency_pairs = await zephyr_engine.resolve_remote_dependencies(
      dependencyPairs,
      extractLibraryType(config.output?.library)
    );
    zephyr_engine.federated_dependencies = mergeResolvedDependencies(
      previousDependencies,
      resolved_dependency_pairs ?? []
    );

    mutWebpackFederatedRemotesConfig(zephyr_engine, config, resolved_dependency_pairs);
    await mutPathModePublicPath(zephyr_engine, config);

    const mfConfig = makeCopyOfModuleFederationOptions(config);

    ze_log.mf(`with-zephyr.mfConfig: ${JSON.stringify(mfConfig, null, 2)}`);

    // inject the ZephyrWebpackPlugin
    (config.plugins ??= []).push(
      new ZeWebpackPlugin({
        zephyr_engine,
        mfConfig: mfConfig,
        wait_for_index_html: _zephyrOptions?.wait_for_index_html,
        hooks: _zephyrOptions?.hooks,
        coordinator: _zephyrOptions?.__coordinator,
        participant: _zephyrOptions?.__participant,
        assetPrefix: _zephyrOptions?.__assetPrefix,
      })
    );
  } catch (error) {
    if (_zephyrOptions?.__coordinator) {
      throw error;
    }
    if (zephyr_engine?.hasActiveBuild !== false) {
      zephyr_engine?.build_failed();
    }
    handleGlobalError(error);
  }

  return config;
}
