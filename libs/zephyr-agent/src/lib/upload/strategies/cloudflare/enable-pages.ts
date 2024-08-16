import { ZephyrPluginOptions, ZeUploadBuildStats } from 'zephyr-edge-contract';
import { zeEnableSnapshotOnPages } from '../../../actions';

export async function enablePages(pluginOptions: ZephyrPluginOptions, buildStats: ZeUploadBuildStats, pages_url: string) {
  return zeEnableSnapshotOnPages({
    pluginOptions,
    envs_jwt: buildStats,
    pages_url,
  });
}
