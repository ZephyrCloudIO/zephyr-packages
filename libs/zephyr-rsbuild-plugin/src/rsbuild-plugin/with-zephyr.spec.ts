import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  engine: {
    application_uid: 'org.project.rsbuild',
    build_id: Promise.resolve('build-1'),
    env: { target: 'web' },
    hasActiveBuild: true,
    build_failed: rs.fn(),
  },
  create: rs.fn(),
  coordinate: rs.fn(),
  handleGlobalError: rs.fn((error: unknown) => {
    if (process.env['ZE_FAIL_BUILD'] === 'true') throw error;
  }),
  snapshotPlugins: rs.fn(() => ['snapshot']),
  restorePlugins: rs.fn(),
  configure: rs.fn(),
  rspackWithZephyr: rs.fn(),
  isZephyrDisabled: rs.fn(() => false),
  disableZephyrForXpack: rs.fn(),
  assertBuildTarget: rs.fn((value: unknown, optionName = 'target') => {
    if (!['web', 'ios', 'android', 'tap-app'].includes(value as string)) {
      throw new TypeError(`${optionName} must be one of web, ios, android, tap-app`);
    }
  }),
}));

rs.mock('zephyr-agent', () => ({
  assertZephyrBuildTarget: mocks.assertBuildTarget,
  handleGlobalError: mocks.handleGlobalError,
  isZephyrDisabled: mocks.isZephyrDisabled,
  ZephyrEngine: { create: mocks.create },
}));

rs.mock('zephyr-xpack-internal', () => ({
  disableZephyrForXpack: mocks.disableZephyrForXpack,
  coordinateXPackCompilers: mocks.coordinate,
  snapshotPlugins: mocks.snapshotPlugins,
  restorePlugins: mocks.restorePlugins,
}));

rs.mock('zephyr-rspack-plugin', () => ({
  withZephyr: mocks.rspackWithZephyr,
}));

import { withZephyr } from './with-zephyr';

describe('Rsbuild withZephyr compiler coordination', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.engine.env.target = 'web';
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
      target: 'tap-app',
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
    expect(mocks.engine.env.target).toBe('tap-app');
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

  it('skips every Zephyr step before creating an engine when ZE_DISABLED is set', async () => {
    let hook:
      | ((options: { bundlerConfigs: Array<Record<string, unknown>> }) => Promise<void>)
      | undefined;
    const plugin = withZephyr();
    await plugin.setup({
      onBeforeCreateCompiler(options: { handler: typeof hook }) {
        hook = options.handler;
      },
    } as never);
    const bundlerConfigs = [{ name: 'web', context: '/repo' }];
    mocks.isZephyrDisabled.mockReturnValue(true);

    try {
      await hook?.({ bundlerConfigs });
    } finally {
      mocks.isZephyrDisabled.mockReturnValue(false);
    }

    expect(mocks.disableZephyrForXpack).toHaveBeenCalledWith(bundlerConfigs);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.coordinate).not.toHaveBeenCalled();
    expect(mocks.rspackWithZephyr).not.toHaveBeenCalled();
  });

  describe('when Zephyr fails while configuring the bundler configs', () => {
    const originalFailBuild = process.env['ZE_FAIL_BUILD'];

    async function registeredHook() {
      let hook:
        | ((options: { bundlerConfigs: Array<Record<string, unknown>> }) => Promise<void>)
        | undefined;
      await withZephyr().setup({
        onBeforeCreateCompiler(options: { handler: typeof hook }) {
          hook = options.handler;
        },
      } as never);
      return hook!;
    }

    afterEach(() => {
      if (originalFailBuild === undefined) delete process.env['ZE_FAIL_BUILD'];
      else process.env['ZE_FAIL_BUILD'] = originalFailBuild;
    });

    it('releases the shared engine and fails the build when ZE_FAIL_BUILD=true', async () => {
      process.env['ZE_FAIL_BUILD'] = 'true';
      const error = new Error('configuration failed');
      mocks.configure.mockRejectedValueOnce(error);
      const hook = await registeredHook();

      await expect(
        hook({ bundlerConfigs: [{ name: 'web', context: '/repo' }] })
      ).rejects.toBe(error);
      expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
    });

    it('releases the engine, removes the plugins and keeps the build green otherwise', async () => {
      delete process.env['ZE_FAIL_BUILD'];
      const error = new Error('configuration failed');
      mocks.configure.mockRejectedValueOnce(error);
      const bundlerConfigs = [{ name: 'web', context: '/repo' }];
      const hook = await registeredHook();

      await expect(hook({ bundlerConfigs })).resolves.toBeUndefined();

      expect(mocks.engine.build_failed).toHaveBeenCalledTimes(1);
      expect(mocks.handleGlobalError).toHaveBeenCalledWith(error);
      expect(mocks.restorePlugins).toHaveBeenCalledWith(bundlerConfigs, ['snapshot']);
    });

    it('follows ZE_FAIL_BUILD when Zephyr cannot start at all', async () => {
      const unreachable = new Error('Zephyr cannot be reached');
      const hook = await registeredHook();

      mocks.create.mockRejectedValueOnce(unreachable);
      delete process.env['ZE_FAIL_BUILD'];
      await expect(
        hook({ bundlerConfigs: [{ name: 'web', context: '/repo' }] })
      ).resolves.toBeUndefined();

      mocks.create.mockRejectedValueOnce(unreachable);
      process.env['ZE_FAIL_BUILD'] = 'true';
      await expect(
        hook({ bundlerConfigs: [{ name: 'web', context: '/repo' }] })
      ).rejects.toBe(unreachable);
    });
  });

  it('rejects unsupported targets before registering a compiler hook', () => {
    expect(() => withZephyr({ target: 'desktop' as never })).toThrow(
      'withZephyr({ target }) must be one of'
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
