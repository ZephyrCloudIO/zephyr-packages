import type { DeploymentResult, ZephyrBuildStats } from 'zephyr-edge-contract';
import { zeUploadBuildStats } from '../../edge-actions/ze-upload-build-stats';
import type { ZephyrEngine } from '../../../zephyr-engine';

interface UploadBuildStatsAndEnableEnvsOptions {
  getDashData: (zephyr_engine: ZephyrEngine) => ZephyrBuildStats;
  versionUrl: string | undefined;
  deploymentResults?: DeploymentResult[];
}

export async function uploadBuildStatsAndEnableEnvs(
  zephyr_engine: ZephyrEngine,
  { getDashData, versionUrl, deploymentResults }: UploadBuildStatsAndEnableEnvsOptions
) {
  const dashData = getDashData(zephyr_engine);
  dashData.edge.versionUrl = versionUrl;

  // Merge deployment results if provided (for multi-CDN status tracking)
  if (deploymentResults && deploymentResults.length > 0) {
    dashData.deploymentResults = deploymentResults;
  }

  return zeUploadBuildStats(dashData);
}
