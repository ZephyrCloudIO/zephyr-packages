import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const mocks = rs.hoisted(() => ({
  rspackConfigure: rs.fn(),
  rspackWithZephyr: rs.fn(),
  webpackConfigure: rs.fn(),
  webpackWithZephyr: rs.fn(),
}));

rs.mock('zephyr-agent', () => ({
  ze_log: { misc: rs.fn() },
}));

rs.mock('zephyr-rspack-plugin', () => ({
  withZephyr: mocks.rspackWithZephyr,
}));

rs.mock('zephyr-webpack-plugin', () => ({
  withZephyr: mocks.webpackWithZephyr,
}));

import { withZephyr } from './with-zephyr';

describe('Modern.js withZephyr', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mocks.rspackWithZephyr.mockReturnValue(mocks.rspackConfigure);
    mocks.webpackWithZephyr.mockReturnValue(mocks.webpackConfigure);
  });

  it('runs after federation config and passes the complete Rspack compiler array once', async () => {
    let hook:
      | ((options: { bundlerConfigs: Array<Record<string, unknown>> }) => Promise<void>)
      | undefined;
    const plugin = withZephyr({ snapshotType: 'ssr', entrypoint: 'server/index.js' });
    await plugin.setup?.({
      onBeforeCreateCompiler(nextHook: typeof hook) {
        hook = nextHook;
      },
      getAppContext() {
        return { bundlerType: 'rspack' };
      },
    } as never);
    const bundlerConfigs = [{ name: 'client' }, { name: 'server' }];

    await hook?.({ bundlerConfigs });

    expect(plugin.pre).toEqual(['@modern-js/plugin-module-federation-config']);
    expect(mocks.rspackWithZephyr).toHaveBeenCalledWith({
      snapshotType: 'ssr',
      entrypoint: 'server/index.js',
    });
    expect(mocks.rspackConfigure).toHaveBeenCalledTimes(1);
    expect(mocks.rspackConfigure).toHaveBeenCalledWith(bundlerConfigs);
    expect(mocks.webpackWithZephyr).not.toHaveBeenCalled();
  });

  it('passes the complete Webpack compiler array once', async () => {
    let hook:
      | ((options: { bundlerConfigs: Array<Record<string, unknown>> }) => Promise<void>)
      | undefined;
    const plugin = withZephyr();
    await plugin.setup?.({
      onBeforeCreateCompiler(nextHook: typeof hook) {
        hook = nextHook;
      },
      getAppContext() {
        return { bundlerType: 'webpack' };
      },
    } as never);
    const bundlerConfigs = [{ name: 'client' }, { name: 'server' }];

    await hook?.({ bundlerConfigs });

    expect(mocks.webpackConfigure).toHaveBeenCalledTimes(1);
    expect(mocks.webpackConfigure).toHaveBeenCalledWith(bundlerConfigs);
    expect(mocks.rspackWithZephyr).not.toHaveBeenCalled();
  });
});
