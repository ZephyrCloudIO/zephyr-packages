import { type ConvertedGraph } from 'zephyr-edge-contract';
import type { ZephyrAgentProps } from '../webpack-plugin/ze-webpack-upload-agent';
import { FederationDashboardPlugin } from './utils/federation-dashboard-plugin/FederationDashboardPlugin';
import { ze_log, ZeErrors, ZephyrError } from 'zephyr-agent';

export async function getBuildStats({
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
}): Promise<ConvertedGraph> {
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

  ze_log('process webpack graph');
  const convertedGraph = dashboardPlugin.processWebpackGraph({ stats, stats_json });

  if (!convertedGraph) {
    throw new ZephyrError(ZeErrors.ERR_CONVERT_GRAPH_TO_DASHBOARD);
  }

  const version = await pluginOptions.zephyr_engine.snapshotId;
  const application_uid = pluginOptions.zephyr_engine.application_uid;
  const buildId = await pluginOptions.zephyr_engine.build_id;

  // todo: add support for multiple fedeation configs
  const mfConfig = Array.isArray(pluginOptions.mfConfig)
    ? pluginOptions.mfConfig[0]
    : pluginOptions.mfConfig;

  const { name, filename, remotes } = (mfConfig || {}) as Record<string, string>;

  const data_overrides = {
    id: application_uid,
    name: name,
    edge: { url: EDGE_URL },
    domain: DOMAIN,
    platform: PLATFORM,
    type: TYPE,
    app: Object.assign({}, app, { buildId }),
    version,
    git,
    remote: filename,
    remotes: Object.keys(remotes || {}),
    context: { isCI },
  };

  // todo: extend data
  const res = Object.assign({}, convertedGraph, data_overrides);
  ze_log('get build stats done.', res);
  return res;
}
