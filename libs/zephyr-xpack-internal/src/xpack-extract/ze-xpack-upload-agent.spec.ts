import { xpack_zephyr_agent } from './ze-xpack-upload-agent';
import { buildWebpackAssetMap } from './build-webpack-assets-map';
import { getBuildStats } from '../federation-dashboard-legacy/get-build-stats';
import { handleGlobalError, ze_log } from 'zephyr-agent';

jest.mock('./build-webpack-assets-map', () => ({
  buildWebpackAssetMap: jest.fn(),
}));

jest.mock('../federation-dashboard-legacy/get-build-stats', () => ({
  getBuildStats: jest.fn(),
}));

jest.mock('zephyr-agent', () => ({
  handleGlobalError: jest.fn(),
  ze_log: {
    init: jest.fn(),
    upload: jest.fn(),
  },
}));

describe('xpack_zephyr_agent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates failures to handleGlobalError', async () => {
    const error = new Error('upload failed');
    (buildWebpackAssetMap as jest.Mock).mockRejectedValue(error);

    await xpack_zephyr_agent({
      stats: {},
      stats_json: {},
      assets: {},
      pluginOptions: {
        zephyr_engine: {},
      },
    } as never);

    expect(handleGlobalError).toHaveBeenCalledWith(error);
    expect(ze_log.upload).toHaveBeenCalled();
    expect(getBuildStats).not.toHaveBeenCalled();
  });

  it('rethrows when handleGlobalError throws', async () => {
    const error = new Error('upload failed');
    (buildWebpackAssetMap as jest.Mock).mockRejectedValue(error);
    (handleGlobalError as jest.Mock).mockImplementation(() => {
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
  });
});
