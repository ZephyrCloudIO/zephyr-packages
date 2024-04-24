import { FederationDashboardPlugin } from './utils/federation-dashboard-plugin/FederationDashboardPlugin';
import * as isCI from 'is-ci';
import {
  ConvertedGraph,
  createSnapshotId,
  ze_error,
  ze_log,
} from 'zephyr-edge-contract';
import { ZephyrAgentProps } from '../lib/ze-agent';

export function getDashboardData({
  stats,
  stats_json,
  pluginOptions,
  EDGE_URL,
}: ZephyrAgentProps & {
  EDGE_URL: string;
}): ConvertedGraph | void {
  ze_log('getDashboardData started. create federation dashboard plugin');
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
  if (!convertedGraph)
    return ze_error('Failed to convert graph to dashboard data');

  /** todo: what we need here:
   // - dependencies, devDependencies, peerDependencies
   // - overrides [
   //   {
   //     "id": "react-dom",
   //     "name": "react-dom",
   //     "version": "18.2.0",
   //     "location": "react-dom",
   //     "applicationID": "react-dom"
   //   },
   //   {
   //     "id": "react",
   //     "name": "react",
   //     "version": "18.2.0",
   //     "location": "react",
   //     "applicationID": "react"
   //   }
   // ]
   // - consumes [
   //   {
   //     "consumingApplicationID": "GreenRecos",
   //     "applicationID": "team-green",
   //     "name": "GreenRecos",
   //     "usedIn": [
   //       {
   //         "file": "src/app/team-red-layout.tsx",
   //         "url": "/src/app/team-red-layout.tsx"
   //       }
   //     ]
   //   },
   //   {
   //     "consumingApplicationID": "BlueBasket",
   //     "applicationID": "team-blue",
   //     "name": "BlueBasket",
   //     "usedIn": [
   //       {
   //         "file": "src/app/team-red-layout.tsx",
   //         "url": "/src/app/team-red-layout.tsx"
   //       }
   //     ]
   //   },
   //   {
   //     "consumingApplicationID": "BlueBuy",
   //     "applicationID": "team-blue",
   //     "name": "BlueBuy",
   //     "usedIn": [
   //       {
   //         "file": "src/app/team-red-layout.tsx",
   //         "url": "/src/app/team-red-layout.tsx"
   //       }
   //     ]
   //   }
   // ]
   // - modules [
   //   {
   //     "id": "TeamRedLayout:TeamRedLayout",
   //     "name": "TeamRedLayout",
   //     "applicationID": "TeamRedLayout",
   //     "requires": [],
   //     "file": "./src/app/team-red-layout"
   //   }
   // ]
   */
  const version = createSnapshotId(pluginOptions);

  const { app, git } = pluginOptions;
  const data_overrides = {
    id: pluginOptions.application_uid,
    name: pluginOptions.mfConfig?.name,
    edge: { url: EDGE_URL },
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
  ze_log('getDashboardData done.', res);
  return res;
}
