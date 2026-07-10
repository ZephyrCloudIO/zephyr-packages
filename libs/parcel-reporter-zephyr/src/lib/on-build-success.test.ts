import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';
import { zeBuildDashData } from 'zephyr-agent';
import { getAssetsMap } from './get-assets-map';
import { onBuildSuccess } from './on-build-success';

rs.mock('zephyr-agent', () => ({
  ZeErrors: { ERR_DEPLOY_LOCAL_BUILD: 'ERR_DEPLOY_LOCAL_BUILD' },
  ZephyrError: class extends Error {},
  zeBuildDashData: rs.fn(),
}));

rs.mock('./get-assets-map', () => ({
  getAssetsMap: rs.fn().mockReturnValue({}),
}));

function buildEvent() {
  return {
    bundleGraph: {
      getBundles: () => [
        {
          filePath: '/project/dist/index.js',
          type: 'js',
          target: { distDir: '/project/dist', name: 'default' },
        },
      ],
    },
  };
}

describe('onBuildSuccess lifecycle', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    (getAssetsMap as Mock).mockReturnValue({});
  });

  it('rolls back a pre-upload failure and permits a later build retry', async () => {
    const statsFailure = new Error('stats failed');
    (zeBuildDashData as Mock)
      .mockRejectedValueOnce(statsFailure)
      .mockResolvedValueOnce({});
    const engine = {
      build_id: Promise.resolve('build-id'),
      start_new_build: rs.fn().mockResolvedValue(undefined),
      upload_assets: rs.fn().mockResolvedValue(undefined),
      build_finished: rs.fn().mockResolvedValue(undefined),
      build_failed: rs.fn(),
    };
    const props = {
      zephyr_engine_defer: Promise.resolve(engine),
      event: buildEvent(),
    } as never;

    await expect(onBuildSuccess(props)).rejects.toBe(statsFailure);
    await expect(onBuildSuccess(props)).resolves.toBeUndefined();

    expect(engine.build_failed).toHaveBeenCalledTimes(1);
    expect(engine.start_new_build).toHaveBeenCalledTimes(2);
    expect(engine.upload_assets).toHaveBeenCalledTimes(1);
    expect(engine.build_finished).toHaveBeenCalledTimes(1);
  });
});
