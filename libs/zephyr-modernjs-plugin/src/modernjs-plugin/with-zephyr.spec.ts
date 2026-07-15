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

  it('runs after federation config and forwards Modern.js options', async () => {
    let modifier:
      | ((config: Record<string, unknown>) => Promise<Record<string, unknown>>)
      | undefined;
    const plugin = withZephyr({
      target: 'tap-app',
      zephyrManifestUrl: 'https://cdn.example.test/app/zephyr-manifest.json',
      snapshotType: 'ssr',
      entrypoint: 'server/index.js',
    });
    await plugin.setup?.({
      modifyRspackConfig(nextModifier: typeof modifier) {
        modifier = nextModifier;
      },
    } as never);
    const config = { name: 'server' };

    await modifier?.(config);

    expect(plugin.pre).toEqual(['@modern-js/plugin-module-federation-config']);
    expect(mocks.rspackWithZephyr).toHaveBeenCalledWith({
      target: 'tap-app',
      zephyrManifestUrl: 'https://cdn.example.test/app/zephyr-manifest.json',
      snapshotType: 'ssr',
      entrypoint: 'server/index.js',
    });
    expect(mocks.rspackConfigure).toHaveBeenCalledTimes(1);
    expect(mocks.rspackConfigure).toHaveBeenCalledWith(config);
  });

  it('handles client and server compiler configs from Modern.js independently', async () => {
    let modifier:
      | ((config: Record<string, unknown>) => Promise<Record<string, unknown>>)
      | undefined;
    const plugin = withZephyr();
    await plugin.setup?.({
      modifyRspackConfig(nextModifier: typeof modifier) {
        modifier = nextModifier;
      },
    } as never);
    const clientConfig = { name: 'client' };
    const serverConfig = { name: 'server' };

    await modifier?.(clientConfig);
    await modifier?.(serverConfig);

    expect(mocks.rspackWithZephyr).toHaveBeenCalledTimes(2);
    expect(mocks.rspackConfigure).toHaveBeenNthCalledWith(1, clientConfig);
    expect(mocks.rspackConfigure).toHaveBeenNthCalledWith(2, serverConfig);
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
