import { ZephyrBuildStats } from 'zephyr-edge-contract';
import { zeUploadBuildStats } from '../../edge-actions/ze-upload-build-stats';
import { ZephyrEngine } from '../../../zephyr-engine';

interface UploadBuildStatsAndEnableEnvsOptions {
  getDashData: (zephyr_engine: ZephyrEngine) => ZephyrBuildStats;
  versionUrl: string;
}

export async function uploadBuildStatsAndEnableEnvs(
  zephyr_engine: ZephyrEngine,
  { getDashData, versionUrl }: UploadBuildStatsAndEnableEnvsOptions
) {
  const dashData = getDashData(zephyr_engine);
  dashData.edge.versionUrl = versionUrl;

  return zeUploadBuildStats(dashData);
}
