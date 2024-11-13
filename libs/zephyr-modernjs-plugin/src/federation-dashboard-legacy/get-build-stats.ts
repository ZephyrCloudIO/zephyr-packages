import * as isCI from 'is-ci';
import {
  type ConvertedGraph,
  createSnapshotId,
  ze_log,
  ZeErrors,
  ZephyrError,
} from 'zephyr-edge-contract';
import type { ZephyrAgentProps } from '../lib/ze-agent';
import { FederationDashboardPlugin } from './utils/federation-dashboard-plugin/FederationDashboardPlugin';

export function getBuildStats({
  stats,
  stats_json,
  pluginOptions,
  EDGE_URL,
  DOMAIN,
  PLATFORM,
  TYPE,
}: ZephyrAgentProps & {
  EDGE_URL: string;
  DOMAIN?: string;
  PLATFORM?: string;
  TYPE?: string;
}): ConvertedGraph {
  ze_log('get build stats started. create federation dashboard plugin');
  const dashboardPlugin = new FederationDashboardPlugin({
    app: pluginOptions.app,
    git: pluginOptions.git,
    context: {
      isCI,
    },
  });

  ze_log('process webpack graph');
  const convertedGraph = dashboardPlugin.processWebpackGraph({
    stats,
    stats_json,
    pluginOptions,
  });

  if (!convertedGraph) {
    throw new ZephyrError(ZeErrors.ERR_CONVERT_GRAPH_TO_DASHBOARD);
  }

  const version = createSnapshotId(pluginOptions);

  const { app, git } = pluginOptions;
  const data_overrides = {
    id: pluginOptions.application_uid,
    name: pluginOptions.mfConfig?.name,
    edge: { url: EDGE_URL },
    domain: DOMAIN,
    platform: PLATFORM,
    type: TYPE,
    app: Object.assign({}, app, { buildId: pluginOptions.zeConfig.buildId }),
    version,
    git,
    remote: pluginOptions.mfConfig?.filename,
    remotes: Object.keys(pluginOptions.mfConfig?.remotes || {}),
    context: {
      isCI: pluginOptions.isCI,
    },
  };

  // todo: extend data
  const res = Object.assign({}, convertedGraph, data_overrides);
  ze_log('get build stats done.', res);
  return res;
}
