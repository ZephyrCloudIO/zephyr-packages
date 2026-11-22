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
import { afterEach, beforeEach, describe, expect, it, rs } from '@rstest/core';
import type * as ZephyrAgent from 'zephyr-agent';

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
}));

rs.mock('zephyr-agent', () => ({
  assertZephyrBundlerBuildTarget: (rs.requireActual('zephyr-agent') as typeof ZephyrAgent)
    .assertZephyrBundlerBuildTarget,
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

  it('rejects the worker target and points to ze-cli', () => {
    // @ts-expect-error worker is publishable through ze-cli only
    const run = () => withZephyr({ target: 'worker' });

    expect(run).toThrow(TypeError);
    expect(run).toThrow('withZephyr({ target }) does not support "worker"');
    expect(run).toThrow('ze-cli');
  });

  it('keeps accepting the web and tap-app targets', () => {
    expect(() => withZephyr({ target: 'web' })).not.toThrow();
    expect(() => withZephyr({ target: 'tap-app' })).not.toThrow();
  });
});
