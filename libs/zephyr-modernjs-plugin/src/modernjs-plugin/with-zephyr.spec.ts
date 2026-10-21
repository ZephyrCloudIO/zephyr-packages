import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  rspackConfigure: rs.fn(),
  rspackWithZephyr: rs.fn(),
  assertBuildTarget: rs.fn((value: unknown, optionName = 'target') => {
    if (!['web', 'ios', 'android', 'tap-app'].includes(value as string)) {
      throw new TypeError(`${optionName} must be one of web, ios, android, tap-app`);
    }
  }),
}));

rs.mock('zephyr-agent', () => ({
  assertZephyrBuildTarget: mocks.assertBuildTarget,
  ze_log: { misc: rs.fn() },
}));

rs.mock('zephyr-rspack-plugin', () => ({
  withZephyr: mocks.rspackWithZephyr,
}));

import { shouldApplyDevPublicPathFix, withZephyr } from './with-zephyr';

describe('Modern.js withZephyr', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.rspackWithZephyr.mockReturnValue(mocks.rspackConfigure);
    mocks.rspackConfigure.mockImplementation(async (config) => config);
  });

  it('configures the finalized compiler array once and forwards options', async () => {
    let beforeCreate:
      | ((input: { bundlerConfigs: object[] }) => Promise<void>)
      | undefined;
    const hooks = { onDeployComplete: rs.fn() };
    const options = { target: 'tap-app' as const, snapshotType: 'csr' as const, hooks };
    const plugin = withZephyr(options);
    await plugin.setup?.({
      onBeforeCreateCompiler(callback: typeof beforeCreate) {
        beforeCreate = callback;
      },
    } as never);
    const configs = [
      { name: 'client', output: { path: '/repo/dist' } },
      { name: 'server', target: 'node', output: { path: '/repo/dist/bundles' } },
    ];
    await beforeCreate?.({ bundlerConfigs: configs });
    expect(plugin.pre).toEqual(['@modern-js/plugin-module-federation-config']);
    expect(mocks.rspackWithZephyr).toHaveBeenCalledExactlyOnceWith({
      ...options,
      __useClientBaseHref: true,
    });
    expect(mocks.rspackConfigure).toHaveBeenCalledExactlyOnceWith(configs);
  });

  it('passes a client-only build through the same array integration', async () => {
    let beforeCreate:
      | ((input: { bundlerConfigs: object[] }) => Promise<void>)
      | undefined;
    await withZephyr().setup?.({
      onBeforeCreateCompiler(callback: typeof beforeCreate) {
        beforeCreate = callback;
      },
    } as never);
    const configs = [{ name: 'client' }];
    await beforeCreate?.({ bundlerConfigs: configs });
    expect(mocks.rspackConfigure).toHaveBeenCalledExactlyOnceWith(configs);
  });

  it('propagates coordinated initialization failures to Modern.js', async () => {
    let beforeCreate:
      | ((input: { bundlerConfigs: object[] }) => Promise<void>)
      | undefined;
    await withZephyr().setup?.({
      onBeforeCreateCompiler(callback: typeof beforeCreate) {
        beforeCreate = callback;
      },
    } as never);
    mocks.rspackConfigure.mockRejectedValue(new Error('server configuration failed'));
    await expect(
      beforeCreate?.({ bundlerConfigs: [{ name: 'client' }, { name: 'server' }] })
    ).rejects.toThrow('server configuration failed');
  });

  it('rejects unsupported targets before registering Modern.js hooks', () => {
    expect(() => withZephyr({ target: 'desktop' as never })).toThrow(
      'withZephyr({ target }) must be one of'
    );
    expect(mocks.rspackWithZephyr).not.toHaveBeenCalled();
  });

  it('never applies the dev public-path rewrite to TAP artifacts', () => {
    expect(shouldApplyDevPublicPathFix('tap-app', true)).toBe(false);
    expect(shouldApplyDevPublicPathFix('web', true)).toBe(true);
  });
});
