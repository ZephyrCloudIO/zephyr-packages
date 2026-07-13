import type { Configuration as RspackConfiguration } from '@rspack/core';
import {
  assertZephyrBuildTarget,
  getGlobal,
  handleGlobalError,
  ZephyrEngine,
  type ZephyrBuildTarget,
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
import type { ZephyrRspackPluginOptions } from '../types';
import { ZeRspackPlugin } from './ze-rspack-plugin';

export type Configuration = RspackConfiguration;

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

function resolveBuildTarget(
  options: ZephyrRspackPluginOptions | undefined
): ZephyrBuildTarget | undefined {
  const target = options?.target;
  if (target !== undefined) {
    assertZephyrBuildTarget(target, 'withZephyr({ target })');
  }
  return target;
}

function applyBuildTarget(
  engine: ZephyrEngine,
  target: ZephyrBuildTarget | undefined
): void {
  if (target !== undefined) {
    engine.env.target = target;
  }
}

export function withZephyr(
  zephyrPluginOptions?: ZephyrRspackPluginOptions
): <T extends Configuration | Configuration[]>(config: T) => Promise<T> {
  const target = resolveBuildTarget(zephyrPluginOptions);
  return async <T extends Configuration | Configuration[]>(config: T): Promise<T> => {
    // Skip Zephyr execution during Nx graph calculation
    // Nx sets global.NX_GRAPH_CREATION = true during graph creation
    if (getGlobal().NX_GRAPH_CREATION) {
      return config;
    }
    if (!Array.isArray(config)) {
      return (await _zephyr_configuration(config, {
        ...zephyrPluginOptions,
        target,
      })) as T;
    }
    if (config.length === 0) {
      return config;
    }

    const engine = await ZephyrEngine.create({
      builder: 'rspack',
      context: config[0]?.context,
      target,
    });
    applyBuildTarget(engine, target);
    try {
      const { coordinator, compilers } = coordinateXPackCompilers(engine, config, {
        snapshotType: zephyrPluginOptions?.snapshotType,
        entrypoint: zephyrPluginOptions?.entrypoint,
      });
      for (const [index, item] of config.entries()) {
        await _zephyr_configuration(item, {
          ...zephyrPluginOptions,
          target,
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
  config: Configuration,
  _zephyrOptions?: ZephyrRspackPluginOptions
): Promise<Configuration> {
  let zephyr_engine: ZephyrEngine | undefined;
  try {
    const target = resolveBuildTarget(_zephyrOptions);
    // create instance of ZephyrEngine to track the application
    zephyr_engine =
      _zephyrOptions?.__engine ??
      (await ZephyrEngine.create({
        builder: 'rspack',
        context: config.context,
        target,
      }));

    // Remote resolution is target-sensitive, so set this before extracting/resolving
    // federation dependencies.
    applyBuildTarget(zephyr_engine, target);

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

    // inject the ZephyrRspackPlugin
    (config.plugins ??= []).push(
      new ZeRspackPlugin({
        zephyr_engine,
        mfConfig: makeCopyOfModuleFederationOptions(config),
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
