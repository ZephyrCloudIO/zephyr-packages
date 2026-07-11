import type { ZephyrEngine } from 'zephyr-agent';
import { resolveMfManifestPath, ze_log, ZeErrors, ZephyrError } from 'zephyr-agent';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import { extractFederatedConfig } from '../xpack-extract/extract-federation-config';
import type { ModuleFederationPlugin, XStats, XStatsCompilation } from '../xpack.types';
import { FederationDashboardPlugin } from './utils/federation-dashboard-plugin/FederationDashboardPlugin';

interface KnownAgentProps {
  stats: XStats;
  stats_json: XStatsCompilation;
  pluginOptions: {
    zephyr_engine: ZephyrEngine;
    // federated module config
    mfConfig?: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
  };
}

export interface ModuleFederationBuildMetadata {
  name?: string;
  remote?: string;
  mf_manifest?: string;
  library_type?: string;
  exposes?: ZephyrBuildStats['exposes'];
  shared?: ZephyrBuildStats['shared'];
}

/** Extracts the publication metadata needed to load an enhanced federation build. */
export function getModuleFederationBuildMetadata(
  mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined
): ModuleFederationBuildMetadata {
  // todo: add support for publishing multiple federation configs independently
  const selectedConfig = Array.isArray(mfConfig) ? mfConfig[0] : mfConfig;
  if (!selectedConfig) {
    return {};
  }

  const federationConfig = extractFederatedConfig(selectedConfig);

  if (!federationConfig) {
    return {};
  }

  // Enhanced MF plugins have an enumerable plugin name and emit the default manifest
  // when `manifest` is omitted. Native/legacy MF plugins do not emit an MF manifest.
  const emitsManifest =
    federationConfig.manifest !== undefined ||
    ('name' in selectedConfig && typeof selectedConfig.name === 'string');

  return {
    name: federationConfig.name,
    remote: federationConfig.filename,
    mf_manifest: emitsManifest
      ? resolveMfManifestPath(federationConfig.manifest)
      : undefined,
    library_type: federationConfig.library?.type ?? 'var',
    exposes: federationConfig.exposes,
    shared: federationConfig.shared,
  };
}

export async function getBuildStats<ZephyrAgentProps extends KnownAgentProps>({
  stats,
  stats_json,
  pluginOptions,
  EDGE_URL,
  DOMAIN,
  PLATFORM,
  TYPE,
  DELIMITER: delimiter = undefined,
}: ZephyrAgentProps & {
  EDGE_URL: string;
  DOMAIN?: string;
  PLATFORM?: string;
  TYPE?: string;
  DELIMITER?: string;
}): Promise<ZephyrBuildStats> {
  ze_log.app('get build stats started. create federation dashboard plugin');
  const ze_engine = pluginOptions.zephyr_engine;
  const app = ze_engine.applicationProperties;
  const { git } = ze_engine.gitProperties;
  const context = ze_engine.env;
  const dashboardPlugin = new FederationDashboardPlugin({
    app,
    git,
    context,
  });

  ze_log.app('process webpack graph.pluginOptions', pluginOptions);
  const convertedGraph = dashboardPlugin.processWebpackGraph({
    stats,
    stats_json,
    pluginOptions,
  });

  if (!convertedGraph) {
    throw new ZephyrError(ZeErrors.ERR_CONVERT_GRAPH_TO_DASHBOARD);
  }

  const version = await ze_engine.snapshotId;
  const application_uid = ze_engine.application_uid;
  const buildId = await ze_engine.build_id;
  const build_target = ze_engine.env.target ?? 'web';

  const federationMetadata = getModuleFederationBuildMetadata(pluginOptions.mfConfig);
  const remotes = ze_engine.federated_dependencies;

  const data_overrides = {
    id: application_uid,
    ...federationMetadata,
    edge: { url: EDGE_URL, delimiter },
    domain: DOMAIN,
    platform: PLATFORM,
    type: TYPE,
    app: Object.assign({}, app, { buildId }),
    version,
    git,
    remotes: remotes?.map(({ application_uid }) => application_uid) ?? [],
    context,
    build_target,
    zephyrDependencies: ze_engine.zephyr_dependencies,
  };

  // todo: extend data

  const res = Object.assign({}, convertedGraph, data_overrides, {
    project: federationMetadata.name, // Add missing project property
    tags: [], // Add missing tags property with empty array as default
  }) as ZephyrBuildStats;
  ze_log.app('get build stats done.', res);
  return res;
}
