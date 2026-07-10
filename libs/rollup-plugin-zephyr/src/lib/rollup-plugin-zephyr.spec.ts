import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import { handleGlobalError } from 'zephyr-agent';
import { withZephyr } from './rollup-plugin-zephyr';

const mocks = rs.hoisted(() => {
  const engine = {
    build_id: Promise.resolve('build-id'),
    start_new_build: rs.fn(),
    upload_assets: rs.fn(),
    build_finished: rs.fn(),
    build_failed: rs.fn(),
  };
  return {
    engine,
    deferCreate: rs.fn(),
    getAssetsMap: rs.fn().mockReturnValue({}),
  };
});

rs.mock('zephyr-agent', () => ({
  ZephyrEngine: {
    defer_create: () => ({
      zephyr_engine_defer: Promise.resolve(mocks.engine),
      zephyr_defer_create: mocks.deferCreate,
    }),
  },
  zeBuildDashData: rs.fn().mockResolvedValue({}),
  handleGlobalError: rs.fn(),
}));

rs.mock('./transform/get-assets-map', () => ({
  getAssetsMap: mocks.getAssetsMap,
}));

describe('rollup Zephyr lifecycle', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.engine.start_new_build.mockResolvedValue(undefined);
    mocks.engine.upload_assets.mockResolvedValue(undefined);
    mocks.engine.build_finished.mockResolvedValue(undefined);
  });

  it('rolls back a failed upload and permits the next writeBundle retry', async () => {
    const uploadFailure = new Error('upload failed');
    mocks.engine.upload_assets.mockRejectedValueOnce(uploadFailure);
    const plugin = withZephyr();
    await plugin.buildStart({ input: 'src/index.ts' } as never);

    await plugin.writeBundle({} as never, {});
    await plugin.writeBundle({} as never, {});

    expect(handleGlobalError).toHaveBeenCalledWith(uploadFailure);
    expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
    expect(mocks.engine.start_new_build).toHaveBeenCalledTimes(2);
    expect(mocks.engine.build_finished).toHaveBeenCalledTimes(1);
  });

  it('releases the active generation when Rollup reports a build error', async () => {
    const plugin = withZephyr();
    await plugin.buildStart({ input: 'src/index.ts' } as never);
    await plugin.buildEnd(new Error('compile failed'));

    expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
  });
});
