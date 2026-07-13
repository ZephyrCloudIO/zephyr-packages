import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';
import { zeBuildDashData } from 'zephyr-agent';
import { getAssetsMap } from './get-assets-map';
import { onBuildSuccess } from './on-build-success';

rs.mock('zephyr-agent', () => ({
  ZeErrors: { ERR_DEPLOY_LOCAL_BUILD: 'ERR_DEPLOY_LOCAL_BUILD' },
  ZephyrError: class extends Error {
    constructor(_code: string, options?: { message?: string }) {
      super(options?.message ?? _code);
    }
  },
  handleGlobalError: (error: unknown) => {
    throw error;
  },
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

function tapMetadata() {
  const mfConfigs = [
    { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
    { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' },
  ];
  const federation = [
    {
      name: 'desktop',
      remote: 'targets/desktop/remoteEntry.mjs',
      library_type: 'module',
    },
    {
      name: 'quickjs',
      remote: 'targets/quickjs/remoteEntry.mjs',
      library_type: 'module',
    },
  ];
  return { mfConfigs, federation };
}

describe('onBuildSuccess lifecycle', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    (getAssetsMap as Mock).mockReturnValue({});
    (zeBuildDashData as Mock).mockResolvedValue({});
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

  it('publishes all TAP federation containers without selecting an arbitrary legacy entry', async () => {
    const { mfConfigs, federation } = tapMetadata();
    (zeBuildDashData as Mock).mockResolvedValue({
      remote: 'stale-legacy-entry.js',
      mf_manifest: 'stale-manifest.json',
      library_type: 'var',
      exposes: { './stale': './stale.ts' },
      shared: { stale: {} },
    });
    const engine = {
      env: { target: 'tap-app' },
      build_id: Promise.resolve('build-id'),
      start_new_build: rs.fn().mockResolvedValue(undefined),
      upload_assets: rs.fn().mockResolvedValue(undefined),
      build_finished: rs.fn().mockResolvedValue(undefined),
      build_failed: rs.fn(),
    };

    await onBuildSuccess({
      zephyr_engine_defer: Promise.resolve(engine),
      event: buildEvent() as never,
      mfConfigs,
      federation,
    });

    const upload = engine.upload_assets.mock.calls[0]?.[0];
    expect(upload).toEqual(
      expect.objectContaining({
        mfConfigs,
        buildStats: expect.objectContaining({
          federation,
          remote: undefined,
          mf_manifest: undefined,
          library_type: undefined,
          exposes: undefined,
          shared: undefined,
        }),
      })
    );
    expect(upload).not.toHaveProperty('mfConfig');
  });

  it('derives the legacy mfConfig only for one complete TAP container', async () => {
    const mfConfig = {
      name: 'desktop',
      filename: 'targets/desktop/remoteEntry.mjs',
    };
    const federation = [
      {
        name: 'desktop',
        remote: 'targets/desktop/remoteEntry.mjs',
        library_type: 'module',
      },
    ];
    const engine = {
      env: { target: 'tap-app' },
      build_id: Promise.resolve('build-id'),
      start_new_build: rs.fn().mockResolvedValue(undefined),
      upload_assets: rs.fn().mockResolvedValue(undefined),
      build_finished: rs.fn().mockResolvedValue(undefined),
      build_failed: rs.fn(),
    };

    await onBuildSuccess({
      zephyr_engine_defer: Promise.resolve(engine),
      event: buildEvent() as never,
      mfConfigs: [mfConfig],
      federation,
    });

    expect(engine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        mfConfig,
        mfConfigs: [mfConfig],
        buildStats: expect.objectContaining({
          federation,
          remote: 'targets/desktop/remoteEntry.mjs',
          library_type: 'module',
        }),
      })
    );
  });

  it('fails closed for missing, empty, uneven, or mismatched TAP Module Federation metadata', async () => {
    const engine = {
      env: { target: 'tap-app' },
      build_id: Promise.resolve('build-id'),
      start_new_build: rs.fn().mockResolvedValue(undefined),
      upload_assets: rs.fn().mockResolvedValue(undefined),
      build_finished: rs.fn().mockResolvedValue(undefined),
      build_failed: rs.fn(),
    };

    await expect(
      onBuildSuccess({
        zephyr_engine_defer: Promise.resolve(engine),
        event: buildEvent() as never,
      })
    ).rejects.toThrow('mfConfigs must be a non-empty array');
    await expect(
      onBuildSuccess({
        zephyr_engine_defer: Promise.resolve(engine),
        event: buildEvent() as never,
        mfConfigs: [],
        federation: [],
      })
    ).rejects.toThrow('mfConfigs must be a non-empty array');
    await expect(
      onBuildSuccess({
        zephyr_engine_defer: Promise.resolve(engine),
        event: buildEvent() as never,
        mfConfigs: [{ name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' }],
        federation: [
          { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
          { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs' },
        ],
      })
    ).rejects.toThrow('must contain the same number of entries');
    await expect(
      onBuildSuccess({
        zephyr_engine_defer: Promise.resolve(engine),
        event: buildEvent() as never,
        mfConfigs: [{ name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' }],
        federation: [{ name: 'desktop', remote: 'targets/quickjs/remoteEntry.mjs' }],
      })
    ).rejects.toThrow('must pair with a federation remote');

    expect(engine.start_new_build).not.toHaveBeenCalled();
    expect(engine.upload_assets).not.toHaveBeenCalled();
  });
});
