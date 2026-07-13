import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';
import { handleGlobalError, zeBuildDashData } from 'zephyr-agent';
import { withZephyr } from './zephyr-rolldown-plugin';

const mocks = rs.hoisted(() => {
  const engine = {
    build_id: Promise.resolve('build-id'),
    buildProperties: {},
    env: { target: 'web' },
    start_new_build: rs.fn(),
    upload_assets: rs.fn(),
    build_finished: rs.fn(),
    build_failed: rs.fn(),
  };
  return {
    engine,
    assertBuildTarget: rs.fn((value: unknown, optionName = 'target') => {
      if (!['web', 'ios', 'android', 'tap-app'].includes(value as string)) {
        throw new TypeError(`${optionName} must be one of web, ios, android, tap-app`);
      }
    }),
    deferCreate: rs.fn(),
    getAssetsMap: rs.fn().mockReturnValue({}),
  };
});

rs.mock('zephyr-agent', () => ({
  assertZephyrBuildTarget: mocks.assertBuildTarget,
  ZeErrors: { ERR_DEPLOY_LOCAL_BUILD: 'ERR_DEPLOY_LOCAL_BUILD' },
  ZephyrError: class extends Error {
    constructor(_code: string, options?: { message?: string }) {
      super(options?.message ?? _code);
    }
  },
  ZephyrEngine: {
    defer_create: () => ({
      zephyr_engine_defer: Promise.resolve(mocks.engine),
      zephyr_defer_create: mocks.deferCreate,
    }),
  },
  zeBuildDashData: rs.fn().mockResolvedValue({}),
  handleGlobalError: rs.fn(),
}));

rs.mock('./internal/get-assets-map', () => ({ getAssetsMap: mocks.getAssetsMap }));

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

describe('Rolldown Zephyr lifecycle', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.engine.start_new_build.mockResolvedValue(undefined);
    mocks.engine.upload_assets.mockResolvedValue(undefined);
    mocks.engine.build_finished.mockResolvedValue(undefined);
    mocks.engine.env.target = 'web';
    mocks.engine.buildProperties = {};
    (zeBuildDashData as Mock).mockResolvedValue({});
  });

  it('rolls back a failed upload and permits the next writeBundle retry', async () => {
    const uploadFailure = new Error('upload failed');
    mocks.engine.upload_assets.mockRejectedValueOnce(uploadFailure);
    const plugin = withZephyr();
    await plugin.buildStart({ input: 'src/index.ts' } as never);

    await plugin.writeBundle({ dir: 'dist' } as never, {});
    await plugin.writeBundle({ dir: 'dist' } as never, {});

    expect(handleGlobalError).toHaveBeenCalledWith(uploadFailure);
    expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
    expect(mocks.engine.start_new_build).toHaveBeenCalledTimes(2);
    expect(mocks.engine.build_finished).toHaveBeenCalledTimes(1);
  });

  it('releases the active generation when Rolldown reports a build error', async () => {
    const plugin = withZephyr();
    await plugin.buildStart({ input: 'src/index.ts' } as never);
    await plugin.buildEnd(new Error('compile failed'));

    expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
  });

  it('passes tap-app into the engine before Rolldown starts a build', async () => {
    const plugin = withZephyr({ target: 'tap-app', ...tapMetadata() });

    await plugin.buildStart({ input: 'src/index.ts' } as never);

    expect(mocks.deferCreate).toHaveBeenCalledWith({
      builder: 'rolldown',
      context: 'src/index.ts',
      target: 'tap-app',
    });
  });

  it('preserves TAP SDK asset paths and bytes instead of prefixing the output directory', async () => {
    const lockedAssets = {
      'sdk-lock-hash': {
        path: 'targets/desktop/remoteEntry.mjs',
        hash: 'sdk-lock-hash',
        extname: '.mjs',
        size: 15,
        buffer: Buffer.from('signed artifact'),
      },
    };
    mocks.engine.env.target = 'tap-app';
    mocks.engine.buildProperties.baseHref = 'stale-local-output';
    mocks.getAssetsMap.mockReturnValue(lockedAssets);
    const plugin = withZephyr({ target: 'tap-app', ...tapMetadata() });
    await plugin.buildStart({ input: 'src/index.ts' } as never);

    await plugin.writeBundle({ dir: '/repo/dist/targets/desktop' } as never, {} as never);

    expect(mocks.engine.buildProperties.baseHref).toBe('');
    expect(mocks.engine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({ assetsMap: lockedAssets })
    );
    expect(mocks.engine.upload_assets.mock.calls[0]?.[0].assetsMap).toBe(lockedAssets);
    expect(lockedAssets['sdk-lock-hash'].buffer).toEqual(Buffer.from('signed artifact'));
  });

  it('retains output-directory base handling for non-TAP builds', async () => {
    const plugin = withZephyr({ target: 'web' });
    await plugin.buildStart({ input: 'src/index.ts' } as never);

    await plugin.writeBundle({ dir: '/repo/dist/web' } as never, {} as never);

    expect(mocks.engine.buildProperties.baseHref).toBe('/repo/dist/web');
  });

  it('rejects unsupported targets before creating a Rolldown plugin', () => {
    expect(() => withZephyr({ target: 'desktop' as never })).toThrow(
      'withZephyr({ target }) must be one of'
    );
  });

  it('publishes every TAP federation container without selecting a legacy first entry', async () => {
    const { mfConfigs, federation } = tapMetadata();
    (zeBuildDashData as Mock).mockResolvedValue({
      remote: 'stale-legacy-entry.js',
      mf_manifest: 'stale-manifest.json',
      library_type: 'var',
      exposes: { './stale': './stale.ts' },
      shared: { stale: {} },
    });
    mocks.engine.env.target = 'tap-app';
    const plugin = withZephyr({ target: 'tap-app', mfConfigs, federation });

    await plugin.buildStart({ input: 'src/index.ts' } as never);
    await plugin.writeBundle({ dir: '/repo/dist' } as never, {});

    const upload = mocks.engine.upload_assets.mock.calls[0]?.[0];
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

  it('derives legacy mfConfig only for one complete container', async () => {
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
    mocks.engine.env.target = 'tap-app';
    const plugin = withZephyr({
      target: 'tap-app',
      mfConfigs: [mfConfig],
      federation,
    });

    await plugin.buildStart({ input: 'src/index.ts' } as never);
    await plugin.writeBundle({ dir: '/repo/dist' } as never, {});

    const upload = mocks.engine.upload_assets.mock.calls[0]?.[0];
    expect(upload).toEqual(
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

  it.each([
    ['omits TAP metadata', undefined, undefined, 'mfConfigs must be a non-empty array'],
    ['supplies empty TAP metadata arrays', [], [], 'mfConfigs must be a non-empty array'],
    [
      'supplies different numbers of config and federation entries',
      [{ name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' }],
      [
        { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
        { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs' },
      ],
      'must contain the same number of entries',
    ],
    [
      'pairs a config with the wrong federation remote',
      [{ name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' }],
      [{ name: 'desktop', remote: 'targets/quickjs/remoteEntry.mjs' }],
      'must pair with a federation remote',
    ],
  ])('fails closed when it %s', (_reason, mfConfigs, federation, expectedMessage) => {
    expect(() =>
      withZephyr({
        target: 'tap-app',
        mfConfigs: mfConfigs as never,
        federation: federation as never,
      })
    ).toThrow(expectedMessage);
  });
});
