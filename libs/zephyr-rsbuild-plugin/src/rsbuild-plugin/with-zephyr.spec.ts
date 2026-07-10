import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  engine: {
    application_uid: 'org.project.rsbuild',
    build_id: Promise.resolve('build-1'),
    hasActiveBuild: true,
    build_failed: rs.fn(),
  },
  create: rs.fn(),
  coordinate: rs.fn(),
  configure: rs.fn(),
  rspackWithZephyr: rs.fn(),
}));

rs.mock('zephyr-agent', () => ({
  ZephyrEngine: { create: mocks.create },
}));

rs.mock('zephyr-xpack-internal', () => ({
  coordinateXPackCompilers: mocks.coordinate,
}));

rs.mock('zephyr-rspack-plugin', () => ({
  withZephyr: mocks.rspackWithZephyr,
}));

import { withZephyr } from './with-zephyr';

describe('Rsbuild withZephyr compiler coordination', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.create.mockResolvedValue(mocks.engine);
    mocks.coordinate.mockReturnValue({
      coordinator: { name: 'shared-coordinator' },
      compilers: [
        { participant: 'web', assetPrefix: 'client' },
        { participant: 'node', assetPrefix: 'server' },
      ],
    });
    mocks.configure.mockImplementation(async (config) => config);
    mocks.rspackWithZephyr.mockImplementation(() => mocks.configure);
  });

  it('creates one engine and passes shared coordination to every bundler config', async () => {
    let hook:
      | ((options: { bundlerConfigs: Array<Record<string, unknown>> }) => Promise<void>)
      | undefined;
    const plugin = withZephyr({
      snapshotType: 'ssr',
      entrypoint: 'server/index.js',
    });
    await plugin.setup({
      onBeforeCreateCompiler(options: { handler: typeof hook }) {
        hook = options.handler;
      },
    } as never);
    const bundlerConfigs = [
      { name: 'web', context: '/repo', output: { path: '/repo/dist/client' } },
      { name: 'node', context: '/repo', output: { path: '/repo/dist/server' } },
    ];

    await hook?.({ bundlerConfigs });

    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.coordinate).toHaveBeenCalledWith(mocks.engine, bundlerConfigs, {
      snapshotType: 'ssr',
      entrypoint: 'server/index.js',
    });
    expect(mocks.rspackWithZephyr).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        __engine: mocks.engine,
        __coordinator: { name: 'shared-coordinator' },
        __participant: 'web',
        __assetPrefix: 'client',
      })
    );
    expect(mocks.rspackWithZephyr).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        __engine: mocks.engine,
        __coordinator: { name: 'shared-coordinator' },
        __participant: 'node',
        __assetPrefix: 'server',
      })
    );
    expect(mocks.configure).toHaveBeenCalledTimes(2);
  });

  it('releases the shared engine when coordinated configuration fails', async () => {
    let hook:
      | ((options: { bundlerConfigs: Array<Record<string, unknown>> }) => Promise<void>)
      | undefined;
    const error = new Error('configuration failed');
    mocks.configure.mockRejectedValueOnce(error);
    const plugin = withZephyr();
    await plugin.setup({
      onBeforeCreateCompiler(options: { handler: typeof hook }) {
        hook = options.handler;
      },
    } as never);

    await expect(
      hook?.({ bundlerConfigs: [{ name: 'web', context: '/repo' }] })
    ).rejects.toBe(error);
    expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
  });
});
