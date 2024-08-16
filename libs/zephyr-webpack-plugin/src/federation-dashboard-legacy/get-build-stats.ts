import { FederationDashboardPlugin } from './utils/federation-dashboard-plugin/FederationDashboardPlugin';
import * as isCI from 'is-ci';
import { ConvertedGraph, createSnapshotId, ze_error, ze_log } from 'zephyr-edge-contract';
import { ZephyrAgentProps } from '../lib/ze-agent';

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
    ze_error('Failed to convert graph to dashboard data');
    throw new Error('Failed to convert graph to dashboard data');
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
  ze_log(`get build stats done. ${JSON.stringify(res)}`);
  return res;
}
