import { rs } from '@rstest/core';
import { xpack_zephyr_agent } from './ze-xpack-upload-agent';
import { buildWebpackAssetMap } from './build-webpack-assets-map';
import { getBuildStats } from '../federation-dashboard-legacy/get-build-stats';
import { emitDeploymentDone } from '../lifecycle-events/index';
import { handleGlobalError, ze_log } from 'zephyr-agent';

rs.mock('./build-webpack-assets-map', () => ({
  buildWebpackAssetMap: rs.fn(),
}));

rs.mock('../federation-dashboard-legacy/get-build-stats', () => ({
  getBuildStats: rs.fn(),
}));

rs.mock('../lifecycle-events/index', () => ({
  emitDeploymentDone: rs.fn(),
}));

rs.mock('zephyr-agent', () => ({
  handleGlobalError: rs.fn(),
  ze_log: {
    init: rs.fn(),
    upload: rs.fn(),
  },
}));

describe('xpack_zephyr_agent', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('delegates failures to handleGlobalError', async () => {
    const error = new Error('upload failed');
    (buildWebpackAssetMap as rs.Mock).mockRejectedValue(error);

    await xpack_zephyr_agent({
      stats: {},
      stats_json: {},
      assets: {},
      pluginOptions: {
        zephyr_engine: {},
      },
    } as never);

    expect(handleGlobalError).toHaveBeenCalledWith(error);
    expect(emitDeploymentDone).toHaveBeenCalled();
    expect(ze_log.upload).toHaveBeenCalled();
    expect(getBuildStats).not.toHaveBeenCalled();
  });

  it('rethrows when handleGlobalError throws', async () => {
    const error = new Error('upload failed');
    (buildWebpackAssetMap as rs.Mock).mockRejectedValue(error);
    (handleGlobalError as rs.Mock).mockImplementation(() => {
      throw error;
    });

    await expect(
      xpack_zephyr_agent({
        stats: {},
        stats_json: {},
        assets: {},
        pluginOptions: {
          zephyr_engine: {},
        },
      } as never)
    ).rejects.toThrow('upload failed');

    expect(emitDeploymentDone).toHaveBeenCalled();
    expect(ze_log.upload).toHaveBeenCalled();
  });
});
