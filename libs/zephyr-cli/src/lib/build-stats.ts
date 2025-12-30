import type { ZephyrBuildStats } from 'zephyr-edge-contract';
import type { ZephyrEngine } from 'zephyr-agent';
import { zeBuildDashData } from 'zephyr-agent';

/**
 * Generate build stats from ZephyrEngine. This is a simple wrapper around zeBuildDashData
 * for consistency.
 */
export async function getBuildStats(
  zephyr_engine: ZephyrEngine
): Promise<ZephyrBuildStats> {
  return await zeBuildDashData(zephyr_engine);
}
