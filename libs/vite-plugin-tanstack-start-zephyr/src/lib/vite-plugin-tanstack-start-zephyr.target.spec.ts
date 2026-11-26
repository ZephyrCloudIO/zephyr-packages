// BDD description (unit tests are generated from this description):
//
//   Scenario: the plugin guards its public `target` option
//     Given an untyped caller passes an unsupported target such as "desktop"
//     Then the plugin throws before doing any work
//
//   Scenario: the plugin rejects the worker target
//     Given a caller passes target "worker"
//     Then the plugin throws a TypeError that points to ze-cli
//     And the "worker" literal is a compile-time error for typed callers
//
//   Scenario: existing targets keep working
//     Given a caller passes target "web" or "tap-app"
//     Then the target guard does not throw
//
// The remaining scenarios in this file cover the plugin lifecycle and are described by the test names.
import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type * as ZephyrAgent from 'zephyr-agent';

const mocks = rs.hoisted(() => ({
  deferCreate: rs.fn(),
  zephyrDeferCreate: rs.fn(),
  buildAssetsMap: rs.fn(),
  loadTanStackOutput: rs.fn(),
  completeParticipant: rs.fn(),
  contribute: rs.fn(),
  completePostprocess: rs.fn(),
  publish: rs.fn(),
  uploadAssets: rs.fn(),
  zeBuildDashData: rs.fn(),
  applicationContextOptions: undefined as
    | {
        publish: (publication: {
          assetsMap: Record<string, unknown>;
        }) => Promise<unknown>;
      }
    | undefined,
  beginBuildOptions: undefined as Record<string, unknown> | undefined,
}));

rs.mock('zephyr-agent', () => {
  class MockZephyrError extends Error {
    constructor(_code: unknown, options?: { message?: string }) {
      super(options?.message ?? String(_code));
    }
  }

  return {
    ApplicationContext: class {
      constructor(options: {
        publish: (publication: {
          assetsMap: Record<string, unknown>;
        }) => Promise<unknown>;
      }) {
        mocks.applicationContextOptions = options;
      }

      beginBuild(options: Record<string, unknown>) {
        mocks.beginBuildOptions = options;
        return {
          completeParticipant: mocks.completeParticipant,
          contribute: mocks.contribute,
          completePostprocess: mocks.completePostprocess,
          publish: mocks.publish,
        };
      }
    },
    assertZephyrBundlerBuildTarget: (
      rs.requireActual('zephyr-agent') as typeof ZephyrAgent
    ).assertZephyrBundlerBuildTarget,
    buildAssetsMap: mocks.buildAssetsMap,
    handleGlobalError: rs.fn(),
    zeBuildDashData: mocks.zeBuildDashData,
    ZeErrors: { ERR_DEPLOY_LOCAL_BUILD: 'ERR_DEPLOY_LOCAL_BUILD' },
    isZephyrDisabled: () => false,
    ZephyrEngine: { defer_create: mocks.deferCreate },
    ZephyrError: MockZephyrError,
    ze_log: { init: rs.fn(), upload: rs.fn() },
  };
});

rs.mock('./internal/extract/load-tanstack-output', () => ({
  loadTanStackOutput: mocks.loadTanStackOutput,
}));

import { withZephyr } from './vite-plugin-tanstack-start-zephyr';

const TAP_FEDERATION_METADATA = {
  mfConfigs: [
    {
      name: 'desktop',
      filename: 'targets/desktop/remoteEntry.mjs',
      library: { type: 'module' },
    },
  ],
  federation: [
    {
      name: 'desktop',
      remote: 'targets/desktop/remoteEntry.mjs',
      library_type: 'module',
    },
  ],
};

describe('withZephyr TanStack Start target propagation', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.applicationContextOptions = undefined;
    mocks.beginBuildOptions = undefined;
    mocks.deferCreate.mockReturnValue({
      zephyr_engine_defer: Promise.resolve({
        application_uid: 'org.project.tanstack',
        start_new_build: rs.fn(),
        upload_assets: mocks.uploadAssets,
        build_finished: rs.fn(),
        build_failed: rs.fn(),
      }),
      zephyr_defer_create: mocks.zephyrDeferCreate,
    });
    mocks.loadTanStackOutput.mockResolvedValue({});
    mocks.buildAssetsMap.mockReturnValue({
      asset: { path: 'server/index.js' },
    });
    mocks.zeBuildDashData.mockResolvedValue({ build: 'stats' });
    mocks.publish.mockResolvedValue(undefined);
  });

  it('rejects an unsupported untyped target before creating an engine', () => {
    expect(() => withZephyr({ target: 'desktop' as never })).toThrow(
      'withZephyr({ target }) must be one of'
    );
    expect(mocks.deferCreate).not.toHaveBeenCalled();
  });

  it('rejects the worker target and points to ze-cli', () => {
    // @ts-expect-error worker is publishable through ze-cli only
    const run = () => withZephyr({ target: 'worker' });

    expect(run).toThrow(TypeError);
    expect(run).toThrow('withZephyr({ target }) does not support "worker"');
    expect(run).toThrow('ze-cli');
  });

  it('keeps accepting the web target (tap-app is covered by the metadata tests)', () => {
    expect(() => withZephyr({ target: 'web' })).not.toThrow();
  });

  it('fails closed when TAP federation metadata is missing or not paired', () => {
    expect(() => withZephyr({ target: 'tap-app' })).toThrow(
      'tap-app metadata must include a non-empty mfConfigs array'
    );
    expect(() =>
      withZephyr({
        target: 'tap-app',
        mfConfigs: TAP_FEDERATION_METADATA.mfConfigs,
        federation: [
          {
            name: 'desktop',
            remote: 'targets/other/remoteEntry.mjs',
            library_type: 'module',
          },
        ],
      })
    ).toThrow('tap-app metadata must pair mfConfigs entry');
    expect(mocks.deferCreate).not.toHaveBeenCalled();
  });

  it('forwards tap-app to ZephyrEngine before publishing the final build tree', async () => {
    const plugin = withZephyr({ target: 'tap-app', ...TAP_FEDERATION_METADATA });
    (plugin.configResolved as (config: unknown) => void)({
      root: '/workspace/tap-package',
    });

    await (plugin.buildApp as { handler: (builder: unknown) => Promise<void> }).handler({
      environments: {
        client: { isBuilt: true },
        server: { isBuilt: true },
      },
    });

    expect(mocks.zephyrDeferCreate).toHaveBeenCalledWith({
      builder: 'vite',
      context: '/workspace/tap-package',
      target: 'tap-app',
    });
  });

  it('publishes every TAP federation container as CSR without selecting a legacy config', async () => {
    const mfConfigs = [
      {
        name: 'desktop',
        filename: 'targets/desktop/remoteEntry.mjs',
        library: { type: 'module' },
      },
      {
        name: 'quickjs',
        filename: 'targets/quickjs/remoteEntry.mjs',
        library: { type: 'module' },
      },
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
    const plugin = withZephyr({ target: 'tap-app', mfConfigs, federation });
    (plugin.configResolved as (config: unknown) => void)({
      root: '/workspace/tap-package',
    });
    mocks.buildAssetsMap.mockReturnValue({
      remote: { path: 'targets/desktop/remoteEntry.mjs' },
    });

    await (plugin.buildApp as { handler: (builder: unknown) => Promise<void> }).handler({
      environments: {
        desktop: { isBuilt: true },
        mobile: { isBuilt: true },
        quickjs: { isBuilt: true },
      },
    });

    expect(mocks.contribute).toHaveBeenCalled();
    expect(mocks.beginBuildOptions).toEqual(
      expect.objectContaining({
        participants: expect.arrayContaining([
          expect.objectContaining({ name: 'tanstack-output', role: 'csr' }),
        ]),
      })
    );

    await mocks.applicationContextOptions?.publish({ assetsMap: {} });

    const upload = mocks.uploadAssets.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(upload).toMatchObject({ snapshotType: 'csr' });
    expect(upload).not.toHaveProperty('entrypoint');
    expect(upload.mfConfigs).toBe(mfConfigs);
    expect(upload).not.toHaveProperty('mfConfig');
    expect(upload.buildStats).toEqual({ build: 'stats', federation });
  });

  it('keeps server entrypoint validation and SSR transport when explicitly requested', async () => {
    const mfConfigs = [
      {
        name: 'desktop',
        filename: 'targets/desktop/remoteEntry.mjs',
        library: { type: 'module' },
      },
    ];
    const federation = [
      {
        name: 'desktop',
        remote: 'targets/desktop/remoteEntry.mjs',
        library_type: 'module',
      },
    ];
    const plugin = withZephyr({
      target: 'tap-app',
      snapshotType: 'ssr',
      entrypoint: 'server/index.mjs',
      mfConfigs,
      federation,
    });
    (plugin.configResolved as (config: unknown) => void)({
      root: '/workspace/tap-package',
    });
    mocks.buildAssetsMap.mockReturnValue({
      server: { path: 'server/index.mjs' },
    });

    await (plugin.buildApp as { handler: (builder: unknown) => Promise<void> }).handler({
      environments: { server: { isBuilt: true } },
    });
    await mocks.applicationContextOptions?.publish({ assetsMap: {} });

    expect(mocks.beginBuildOptions).toEqual(
      expect.objectContaining({
        participants: expect.arrayContaining([
          expect.objectContaining({ name: 'tanstack-output', role: 'ssr' }),
        ]),
      })
    );
    expect(mocks.uploadAssets).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotType: 'ssr',
        entrypoint: 'server/index.mjs',
      })
    );
    const upload = mocks.uploadAssets.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(upload.mfConfigs).toBe(mfConfigs);
    expect(upload.mfConfig).toBe(mfConfigs[0]);
    expect(upload.buildStats).toEqual({ build: 'stats', federation });
  });
});
