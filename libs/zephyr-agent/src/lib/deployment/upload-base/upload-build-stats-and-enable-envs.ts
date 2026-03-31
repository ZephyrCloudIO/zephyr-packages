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
  const dashData = getDashData(zephyr_engine);
  dashData.edge.versionUrl = versionUrl;

  const start = Date.now();
  zephyr_engine.target_urls = await zeUploadBuildStats(dashData);
  zephyr_engine.build_stats_time = Date.now() - start;

  return true;
}
