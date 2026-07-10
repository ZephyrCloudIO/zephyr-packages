import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { uploadAssets } from './upload';

rs.mock('./build-stats', () => ({
  getBuildStats: rs.fn().mockResolvedValue({}),
}));

rs.mock('zephyr-agent', () => ({
  logFn: rs.fn(),
  ZephyrError: { format: (error: unknown) => String(error) },
}));

describe('CLI upload lifecycle', () => {
  const engine = {
    build_id: Promise.resolve('build-id'),
    start_new_build: rs.fn(),
    upload_assets: rs.fn(),
    build_finished: rs.fn(),
    build_failed: rs.fn(),
  };

  beforeEach(() => {
    rs.clearAllMocks();
    engine.start_new_build.mockResolvedValue(undefined);
    engine.upload_assets.mockResolvedValue(undefined);
    engine.build_finished.mockResolvedValue(undefined);
  });

  it('rolls back a failed upload and permits a later invocation to retry', async () => {
    const uploadFailure = new Error('upload failed');
    engine.upload_assets.mockRejectedValueOnce(uploadFailure);
    const options = { zephyr_engine: engine, assetsMap: {} } as never;

    await expect(uploadAssets(options)).rejects.toBe(uploadFailure);
    await expect(uploadAssets(options)).resolves.toBeUndefined();

    expect(engine.build_failed).toHaveBeenCalledTimes(1);
    expect(engine.start_new_build).toHaveBeenCalledTimes(2);
    expect(engine.build_finished).toHaveBeenCalledTimes(1);
  });
});
