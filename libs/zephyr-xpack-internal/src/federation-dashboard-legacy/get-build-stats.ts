import type { ZephyrEngine } from 'zephyr-agent';
import { ze_log, ZeErrors, ZephyrError } from 'zephyr-agent';
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
    mfConfig: ModuleFederationPlugin[] | ModuleFederationPlugin | undefined;
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
  const { isCI } = ze_engine.env;
  const dashboardPlugin = new FederationDashboardPlugin({
    app,
    git,
    context: {
      isCI,
    },
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

  // todo: add support for multiple federation configs
  const mfConfig = Array.isArray(pluginOptions.mfConfig)
    ? pluginOptions.mfConfig[0]
    : pluginOptions.mfConfig;

  const { name, filename } = mfConfig ? (extractFederatedConfig(mfConfig) ?? {}) : {};
  const remotes = ze_engine.federated_dependencies;

  // Build zephyr:dependencies from federated_dependencies
  const zephyrDependencies: Record<string, any> = {};
  if (remotes) {
    for (const dep of remotes) {
      zephyrDependencies[dep.name] = {
        application_uid: dep.application_uid,
        remote_entry_url: dep.remote_entry_url,
        default_url: dep.default_url,
        name: dep.name,
        library_type: dep.library_type || 'module',
      };
    }
  }

  const data_overrides = {
    id: application_uid,
    name: name,
    edge: { url: EDGE_URL, delimiter },
    domain: DOMAIN,
    platform: PLATFORM,
    type: TYPE,
    app: Object.assign({}, app, { buildId }),
    version,
    git,
    remote: filename,
    remotes: remotes?.map(({ application_uid }) => application_uid) ?? [],
    context: { isCI },
    build_target,
    'zephyr:dependencies': zephyrDependencies,
  };

  // todo: extend data

  const res = Object.assign({}, convertedGraph, data_overrides, {
    project: name, // Add missing project property
    tags: [], // Add missing tags property with empty array as default
  }) as ZephyrBuildStats;
  ze_log.app('get build stats done.', res);
  return res;
}
