import type { ZephyrEngine } from 'zephyr-agent';
import { ze_log, ZeErrors, ZephyrError } from 'zephyr-agent';
import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import { parseRemotesAsEntries } from '../xpack-extract';
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
  ze_log('get build stats started. create federation dashboard plugin');
  const app = pluginOptions.zephyr_engine.applicationProperties;
  const { git } = pluginOptions.zephyr_engine.gitProperties;
  const { isCI } = pluginOptions.zephyr_engine.env;
  const dashboardPlugin = new FederationDashboardPlugin({
    app,
    git,
    context: {
      isCI,
    },
  });

  ze_log('process webpack graph.pluginOptions', pluginOptions);
  const convertedGraph = dashboardPlugin.processWebpackGraph({
    stats,
    stats_json,
    pluginOptions,
  });

  if (!convertedGraph) {
    throw new ZephyrError(ZeErrors.ERR_CONVERT_GRAPH_TO_DASHBOARD);
  }

  const version = await pluginOptions.zephyr_engine.snapshotId;
  const application_uid = pluginOptions.zephyr_engine.application_uid;
  const buildId = await pluginOptions.zephyr_engine.build_id;

  // todo: add support for multiple federation configs
  const mfConfig = Array.isArray(pluginOptions.mfConfig)
    ? pluginOptions.mfConfig[0]
    : pluginOptions.mfConfig;

  const { name, filename, remotes } = mfConfig
    ? (extractFederatedConfig(mfConfig) ?? {})
    : {};

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
    remotes: parseRemotesAsEntries(remotes).map(([remote_name]) => remote_name),
    context: { isCI },
    native: {
      build_target: pluginOptions.zephyr_engine.env.target,
      native_version: pluginOptions.zephyr_engine.env.native_version,
      native_build_number: pluginOptions.zephyr_engine.env.native_build_number,
      native_config_file_hash: pluginOptions.zephyr_engine.env.native_config_file_hash,
    },
  };

  // todo: extend data

  const res = Object.assign({}, convertedGraph, data_overrides, {
    project: name, // Add missing project property
    tags: [], // Add missing tags property with empty array as default
  }) as ZephyrBuildStats;
  ze_log('get build stats done.', res);
  return res;
}
