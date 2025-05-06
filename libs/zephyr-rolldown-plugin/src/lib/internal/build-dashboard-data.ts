import { InputOptions } from 'rolldown';
import { ZephyrEngine, zeBuildDashData } from 'zephyr-agent';
import { extractModuleFederationConfig } from './extract-module-federation-config';
import { ZephyrBuildStats, ZephyrPluginOptions } from 'zephyr-edge-contract';

/**
 * Builds dashboard data including module federation configuration
 *
 * @param zephyrEngine Initialized ZephyrEngine
 * @param options Rolldown input options
 * @returns The build stats object for the dashboard
 */
export async function buildDashboardData(
  zephyrEngine: ZephyrEngine,
  options?: InputOptions
): Promise<ZephyrBuildStats> {
  // Get the standard build data
  const buildData = await zeBuildDashData(zephyrEngine);

  // If we have options, extract module federation config
  if (options) {
    const mfConfig = extractModuleFederationConfig(options);
    if (mfConfig) {
      // Clean and convert the config to match expected format
      const cleanConfig = {
        name: mfConfig.name,
        filename: mfConfig.filename || 'remoteEntry.js',
        remotes: mfConfig.remotes,
        exposes: mfConfig.exposes,
        shared: mfConfig.shared,
      };

      // Set the module federation config in the build data
      return {
        ...buildData,
        mfConfig: [cleanConfig],
      } as ZephyrBuildStats;
    }
  }

  return buildData;
}
