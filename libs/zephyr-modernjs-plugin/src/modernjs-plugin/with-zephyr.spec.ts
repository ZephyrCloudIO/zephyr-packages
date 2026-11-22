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
  rspackConfigure: rs.fn(),
  rspackWithZephyr: rs.fn(),
}));

rs.mock('zephyr-agent', () => ({
  assertZephyrBundlerBuildTarget: (rs.requireActual('zephyr-agent') as typeof ZephyrAgent)
    .assertZephyrBundlerBuildTarget,
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

  it('never applies the dev public-path rewrite to TAP artifacts', () => {
    expect(shouldApplyDevPublicPathFix('tap-app', true)).toBe(false);
    expect(shouldApplyDevPublicPathFix('web', true)).toBe(true);
  });
});
