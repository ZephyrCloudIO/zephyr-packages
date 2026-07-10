import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

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
  zeBuildAssets: rs.fn(({ filepath, content }) => ({
    path: filepath,
    hash: `rehash:${filepath}`,
    extname: '.js',
    size: Buffer.byteLength(content),
    buffer: content,
  })),
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
    const buildFailed = rs.fn();
    (buildWebpackAssetMap as Mock).mockRejectedValue(error);

    await xpack_zephyr_agent({
      stats: {},
      stats_json: {},
      assets: {},
      pluginOptions: {
        zephyr_engine: { build_failed: buildFailed },
      },
    } as never);

    expect(buildFailed).toHaveBeenCalledTimes(1);
    expect(handleGlobalError).toHaveBeenCalledWith(error);
    expect(emitDeploymentDone).toHaveBeenCalled();
    expect(ze_log.upload).toHaveBeenCalled();
    expect(getBuildStats).not.toHaveBeenCalled();
  });

  it('rethrows when handleGlobalError throws', async () => {
    const error = new Error('upload failed');
    const buildFailed = rs.fn();
    (buildWebpackAssetMap as Mock).mockRejectedValue(error);
    (handleGlobalError as Mock).mockImplementation(() => {
      throw error;
    });

    await expect(
      xpack_zephyr_agent({
        stats: {},
        stats_json: {},
        assets: {},
        pluginOptions: {
          zephyr_engine: { build_failed: buildFailed },
        },
      } as never)
    ).rejects.toThrow('upload failed');

    expect(buildFailed).toHaveBeenCalledTimes(1);
    expect(emitDeploymentDone).toHaveBeenCalled();
    expect(ze_log.upload).toHaveBeenCalled();
  });

  it('rehashes prefixed assets and propagates coordinated publication failures', async () => {
    const error = new Error('coordinated upload failed');
    const contribute = rs.fn().mockRejectedValue(error);
    (buildWebpackAssetMap as Mock).mockResolvedValue({
      original: {
        path: 'app.js',
        hash: 'original',
        extname: '.js',
        size: 1,
        buffer: 'x',
      },
    });
    (getBuildStats as Mock).mockResolvedValue({});

    await expect(
      xpack_zephyr_agent({
        stats: {},
        stats_json: {},
        assets: {},
        pluginOptions: {
          zephyr_engine: {
            application_configuration: Promise.resolve({
              EDGE_URL: 'edge',
              PLATFORM: 'web',
              DELIMITER: '.',
            }),
          },
          coordinator: { contribute },
          participant: 'client',
          generation: 3,
          assetPrefix: 'client',
        },
      } as never)
    ).rejects.toThrow('coordinated upload failed');

    expect(contribute).toHaveBeenCalledWith(
      expect.objectContaining({
        participant: 'client',
        generation: 3,
        assetsMap: {
          'rehash:client/app.js': expect.objectContaining({
            path: 'client/app.js',
          }),
        },
      })
    );
    expect(handleGlobalError).not.toHaveBeenCalled();
    expect(emitDeploymentDone).not.toHaveBeenCalled();
  });
});
