import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  deferCreate: rs.fn(),
  zephyrDeferCreate: rs.fn(),
  buildAssetsMap: rs.fn(),
  loadTanStackOutput: rs.fn(),
  completeParticipant: rs.fn(),
  contribute: rs.fn(),
  completePostprocess: rs.fn(),
  publish: rs.fn(),
}));

rs.mock('zephyr-agent', () => {
  class MockZephyrError extends Error {
    constructor(_code: unknown, options?: { message?: string }) {
      super(options?.message ?? String(_code));
    }
  }

  return {
    ApplicationContext: class {
      beginBuild() {
        return {
          completeParticipant: mocks.completeParticipant,
          contribute: mocks.contribute,
          completePostprocess: mocks.completePostprocess,
          publish: mocks.publish,
        };
      }
    },
    assertZephyrBuildTarget: rs.fn(),
    buildAssetsMap: mocks.buildAssetsMap,
    handleGlobalError: rs.fn(),
    zeBuildDashData: rs.fn(),
    ZeErrors: { ERR_DEPLOY_LOCAL_BUILD: 'ERR_DEPLOY_LOCAL_BUILD' },
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

describe('TanStack Start TAP output transport', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.deferCreate.mockReturnValue({
      zephyr_engine_defer: Promise.resolve({
        application_uid: 'org.project.tanstack',
        start_new_build: rs.fn(),
        upload_assets: rs.fn(),
        build_finished: rs.fn(),
        build_failed: rs.fn(),
      }),
      zephyr_defer_create: mocks.zephyrDeferCreate,
    });
    mocks.loadTanStackOutput.mockResolvedValue({});
    mocks.buildAssetsMap.mockReturnValue({
      asset: { path: 'server/index.js' },
    });
    mocks.publish.mockResolvedValue(undefined);
  });

  it('passes tap-app to the output loader before assets are mapped', async () => {
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

    expect(mocks.loadTanStackOutput).toHaveBeenCalledWith('/workspace/tap-package/dist', {
      target: 'tap-app',
    });
  });
});
