import type { ZeBuildAssetsMap, ZephyrEngine, ZephyrBuildHooks } from 'zephyr-agent';
import {
  assertTapFederationPublicationMetadata,
  handleGlobalError,
  zeBuildAssets,
  ZeErrors,
  ZephyrError,
  ze_log,
} from 'zephyr-agent';
import { type Source, type ZephyrBuildStats } from 'zephyr-edge-contract';
import {
  getBuildStats,
  getModuleFederationConfigs,
} from '../federation-dashboard-legacy/get-build-stats';
import { getLegacyModuleFederationConfig } from './federation-config-metadata';
import { emitDeploymentDone } from '../lifecycle-events/index';
import { buildWebpackAssetMap } from '../xpack-extract/build-webpack-assets-map';
import type { ModuleFederationPlugin, XStats, XStatsCompilation } from '../xpack.types';
import type {
  XPackBuildCoordinator,
  XPackParticipantDependencyPaths,
} from './xpack-build-coordinator';

export interface UploadAgentPluginOptions {
  zephyr_engine: ZephyrEngine;
  wait_for_index_html?: boolean;
  // federated module config
  mfConfig?: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  hooks?: ZephyrBuildHooks;
  coordinator?: XPackBuildCoordinator;
  participant?: string;
  assetPrefix?: string;
  generation?: number;
  dependencyPaths?: XPackParticipantDependencyPaths;
}

export interface ZephyrAgentProps<T> {
  stats: XStats;
  stats_json: XStatsCompilation;
  pluginOptions: T;
  assets: Record<string, Source>;
}

export async function xpack_zephyr_agent<T extends UploadAgentPluginOptions>({
  stats,
  stats_json,
  assets,
  pluginOptions,
}: ZephyrAgentProps<T>): Promise<void> {
  ze_log.init('Initiating: Zephyr Webpack Upload Agent');

  const zeStart = Date.now();
  const { wait_for_index_html, zephyr_engine } = pluginOptions;
  const preserveTapArtifactPaths = zephyr_engine.env?.target === 'tap-app';
  let logicalDeploymentCompleted = !pluginOptions.coordinator;

  try {
    if (preserveTapArtifactPaths) {
      // The TAP SDK signs package-relative paths. A bundler base/public path must not
      // turn those immutable artifact keys into local-output-prefixed paths later in
      // createSnapshot.
      zephyr_engine.buildProperties.baseHref = '';
    }
    let assetsMap = await buildWebpackAssetMap(assets, {
      // The waiter synthesizes a replacement index.html after compilation. TAP owns
      // descriptor-locked HTML itself, so only upload assets that the SDK emitted.
      wait_for_index_html: preserveTapArtifactPaths ? false : wait_for_index_html,
      failOnUnsupportedSource: preserveTapArtifactPaths,
    });
    if (pluginOptions.assetPrefix && !preserveTapArtifactPaths) {
      assetsMap = prefixAssetPaths(assetsMap, pluginOptions.assetPrefix);
    }

    // webpack dash data
    const { EDGE_URL, PLATFORM, DELIMITER } =
      await zephyr_engine.application_configuration;

    const dashData = await getBuildStats({
      stats,
      stats_json,
      assets,
      pluginOptions,
      EDGE_URL,
      PLATFORM,
      DELIMITER,
    });

    const mfConfigs = getModuleFederationConfigs(pluginOptions.mfConfig);
    const mfConfig = getLegacyModuleFederationConfig(mfConfigs);

    // Direct (non-coordinated) Webpack/Rspack builds pass through this path. A
    // coordinator validates after merging its compiler contributions below.
    if (!pluginOptions.coordinator) {
      assertTapFederationPublicationMetadata({
        target: zephyr_engine.env?.target,
        mfConfigs,
        federation: (dashData as ZephyrBuildStats).federation,
      });
    }

    if (pluginOptions.coordinator) {
      if (!pluginOptions.participant) {
        throw new ZephyrError(ZeErrors.ERR_DEPLOY_LOCAL_BUILD, {
          message: 'A coordinated xpack build requires a participant name',
        });
      }
      logicalDeploymentCompleted = await pluginOptions.coordinator.contribute({
        participant: pluginOptions.participant,
        generation: pluginOptions.generation,
        assetsMap,
        mfConfigs: mfConfigs.length > 0 ? mfConfigs : undefined,
        buildStats: dashData as unknown as ZephyrBuildStats,
        hooks: pluginOptions.hooks,
        dependencyPaths: pluginOptions.dependencyPaths,
      });
      return;
    }

    await zephyr_engine.upload_assets({
      assetsMap,
      mfConfigs: mfConfigs.length > 0 ? mfConfigs : undefined,
      mfConfig,
      buildStats: dashData as unknown as ZephyrBuildStats,
      hooks: pluginOptions.hooks,
    });
    await zephyr_engine.build_finished();
  } catch (err) {
    if (pluginOptions.coordinator) {
      throw err;
    }
    // setupZeDeploy starts direct builds. Any failure before build_finished must release
    // that generation so watch mode can retry with fresh identity and logger state.
    if (zephyr_engine.hasActiveBuild !== false) {
      zephyr_engine.build_failed();
    }
    handleGlobalError(err);
  } finally {
    if (logicalDeploymentCompleted) {
      emitDeploymentDone();
    }
    ze_log.upload('Zephyr Webpack Upload Agent: Done in', Date.now() - zeStart, 'ms');
  }
}

function prefixAssetPaths(
  assetsMap: ZeBuildAssetsMap,
  assetPrefix: string
): ZeBuildAssetsMap {
  const normalizedPrefix = assetPrefix.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  if (!normalizedPrefix) {
    return assetsMap;
  }

  return Object.fromEntries(
    Object.values(assetsMap).map((asset) => {
      const prefixedPath = asset.path.startsWith(`${normalizedPrefix}/`)
        ? asset.path
        : `${normalizedPrefix}/${asset.path.replace(/^\/+/, '')}`;
      const prefixedAsset = zeBuildAssets({
        filepath: prefixedPath,
        content: asset.buffer,
      });
      return [prefixedAsset.hash, prefixedAsset];
    })
  );
}
