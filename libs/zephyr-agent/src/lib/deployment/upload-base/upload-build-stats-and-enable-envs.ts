import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import type { ZephyrEngine } from '../../../zephyr-engine';
import { zeUploadBuildStats } from '../../edge-actions/ze-upload-build-stats';

interface UploadBuildStatsAndEnableEnvsOptions {
  getDashData: (zephyr_engine: ZephyrEngine) => ZephyrBuildStats;
  versionUrl: string;
}

export async function uploadBuildStatsAndEnableEnvs(
  zephyr_engine: ZephyrEngine,
  { getDashData, versionUrl }: UploadBuildStatsAndEnableEnvsOptions
) {
  /** This step only reports build stats; blocking wait now happens at engine shutdown. */
  const dashData = getDashData(zephyr_engine);
  dashData.edge.versionUrl = versionUrl;

  const report = await zeUploadBuildStats(dashData);
  zephyr_engine.deployment_build_id = report.buildId;

  return report;
}
