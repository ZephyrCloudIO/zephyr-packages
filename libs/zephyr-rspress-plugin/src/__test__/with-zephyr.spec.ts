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

/* eslint-disable @typescript-eslint/no-unused-vars */
import { withZephyr } from '../with-zephyr';

type RspressConfigHook = NonNullable<ReturnType<typeof withZephyr>['config']>;
type RspressConfigArg = Parameters<RspressConfigHook>[0];

/** The tests feed minimal Rspress config objects, so narrow them once here. */
function asConfig(value: object): RspressConfigArg {
  return value as unknown as RspressConfigArg;
}

const rspressPluginMock = rs.fn((..._args: unknown[]) => ({ name: 'mock-ssg-plugin' }));

rs.mock('../zephyrRspressSSGPlugin', () => ({
  zephyrRspressSSGPlugin: (...args: unknown[]) => rspressPluginMock(...args),
}));

const rsbuildPluginMock = rs.fn((..._args: unknown[]) => ({
  name: 'mock-rsbuild-plugin',
}));
const portableFederationPlugin = { name: 'mock-mf-public-path-plugin' };
let onModuleFederationPlugins: ((plugins: unknown[]) => void) | undefined;
const moduleFederationPublicPathPluginMock = rs.fn((...args: unknown[]) => {
  const options = args[0] as
    | { onModuleFederationPlugins?: (plugins: unknown[]) => void }
    | undefined;
  onModuleFederationPlugins = options?.onModuleFederationPlugins;
  return portableFederationPlugin;
});

rs.mock('../internal/assets/moduleFederationPublicPathPlugin', () => ({
  moduleFederationPublicPathPlugin: (...args: unknown[]) =>
    moduleFederationPublicPathPluginMock(...args),
}));

rs.mock('zephyr-rsbuild-plugin', () => ({
  withZephyr: (...args: unknown[]) => rsbuildPluginMock(...args),
}));

describe('withZephyr', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    onModuleFederationPlugins = undefined;
  });

  it('rejects an unsupported untyped target before configuring Rspress', () => {
    expect(() => withZephyr({ target: 'desktop' as never })).toThrow(
      'withZephyr({ target }) must be one of'
    );
    expect(rspressPluginMock).not.toHaveBeenCalled();
    expect(rsbuildPluginMock).not.toHaveBeenCalled();
  });

  it('rejects the worker target and points to ze-cli before configuring Rspress', () => {
    // @ts-expect-error worker is publishable through ze-cli only
    const run = () => withZephyr({ target: 'worker' });

    expect(run).toThrow(TypeError);
    expect(run).toThrow('withZephyr({ target }) does not support "worker"');
    expect(run).toThrow('ze-cli');
    expect(rspressPluginMock).not.toHaveBeenCalled();
    expect(rsbuildPluginMock).not.toHaveBeenCalled();
  });

  it('keeps accepting the web and tap-app targets', () => {
    expect(() => withZephyr({ target: 'web' })).not.toThrow();
    expect(() => withZephyr({ target: 'tap-app' })).not.toThrow();
  });

  it('should add the zephyrRspressSSGPlugin when ssg is true', async () => {
    const addPlugin = rs.fn();
    const plugin = withZephyr();
    const config = {
      ssg: true,
      outDir: 'dist',
    };

    const removePlugin = rs.fn();
    const result = await plugin.config?.(
      asConfig(config),
      { addPlugin, removePlugin },
      false
    );

    expect(rspressPluginMock).toHaveBeenCalledWith(config, { mfConfig: [] });
    expect(addPlugin).toHaveBeenCalledWith({ name: 'mock-ssg-plugin' });
    expect(result?.builderConfig?.plugins).toContain(portableFederationPlugin);
    expect(result).toEqual(config);
  });

  it('should add the zephyrRsbuildPlugin when ssg is false', async () => {
    const addPlugin = rs.fn();
    const removePlugin = rs.fn();
    const config = {
      ssg: false,
      builderConfig: {
        plugins: [],
      },
    };

    const plugin = withZephyr();
    const result = await plugin.config?.(
      asConfig(config),
      { addPlugin, removePlugin },
      false
    );

    expect(rsbuildPluginMock).toHaveBeenCalled();
    expect(result?.builderConfig?.plugins).toContainEqual({
      name: 'mock-rsbuild-plugin',
    });
    expect(addPlugin).not.toHaveBeenCalled();
  });

  it('forwards tap-app to both the SSG and Rsbuild publication paths', async () => {
    const ssgConfig = { ssg: true, outDir: 'dist' };
    await withZephyr({ target: 'tap-app' }).config?.(
      asConfig(ssgConfig),
      { addPlugin: rs.fn(), removePlugin: rs.fn() },
      false
    );
    expect(rspressPluginMock).toHaveBeenCalledWith(ssgConfig, {
      target: 'tap-app',
      mfConfig: [],
    });
    expect(moduleFederationPublicPathPluginMock).toHaveBeenCalledWith(
      expect.objectContaining({ target: 'tap-app' })
    );

    const builderConfig = { ssg: false, builderConfig: { plugins: [] } };
    await withZephyr({ target: 'tap-app' }).config?.(
      asConfig(builderConfig),
      { addPlugin: rs.fn(), removePlugin: rs.fn() },
      false
    );
    expect(rsbuildPluginMock).toHaveBeenCalledWith({ target: 'tap-app' });
  });

  it('retains every SSG compiler federation plugin for publication', async () => {
    const config = { ssg: true, outDir: 'dist' };
    await withZephyr({ target: 'tap-app' }).config?.(
      asConfig(config),
      { addPlugin: rs.fn(), removePlugin: rs.fn() },
      false
    );
    const desktop = {
      name: 'RspackModuleFederationPlugin',
      apply() {},
      _options: { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
    };
    const worker = {
      name: 'RspackModuleFederationPlugin',
      apply() {},
      _options: { name: 'worker', filename: 'targets/worker/remoteEntry.mjs' },
    };

    expect(onModuleFederationPlugins).toEqual(expect.any(Function));
    onModuleFederationPlugins?.([desktop, worker]);

    expect(rspressPluginMock).toHaveBeenCalledWith(
      config,
      expect.objectContaining({ mfConfig: [desktop, worker] })
    );
  });

  it('should handle missing builderConfig when ssg is false', async () => {
    const addPlugin = rs.fn();
    const removePlugin = rs.fn();
    const config = {
      ssg: false,
    };

    const plugin = withZephyr();
    const result = await plugin.config?.(
      asConfig(config),
      { addPlugin, removePlugin },
      false
    );

    expect(rsbuildPluginMock).toHaveBeenCalled();
    expect(result?.builderConfig?.plugins).toContainEqual({
      name: 'mock-rsbuild-plugin',
    });
    expect(addPlugin).not.toHaveBeenCalled();
  });

  it('should handle errors thrown by zephyrRspressSSGPlugin', async () => {
    rspressPluginMock.mockImplementation(() => {
      throw new Error('SSG plugin failed');
    });

    const addPlugin = rs.fn();
    const removePlugin = rs.fn();
    const config = { ssg: true, outDir: 'dist' };

    const plugin = withZephyr();

    await expect(
      plugin.config?.(asConfig(config), { addPlugin, removePlugin }, false)
    ).rejects.toThrow('SSG plugin failed');
  });

  it('should handle undefined config gracefully', async () => {
    const addPlugin = rs.fn();
    const removePlugin = rs.fn();
    const config = {};

    const plugin = withZephyr();
    const result = await plugin.config?.(
      asConfig(config),
      { addPlugin, removePlugin },
      false
    );

    expect(rsbuildPluginMock).toHaveBeenCalled();
    expect(result?.builderConfig?.plugins).toContainEqual({
      name: 'mock-rsbuild-plugin',
    });
  });

  it('should not add rsbuild plugin twice', async () => {
    const config = {
      ssg: false,
      builderConfig: {
        plugins: [{ name: 'mock-rsbuild-plugin' }],
      },
    };

    const plugin = withZephyr();
    const result = await plugin.config?.(
      asConfig(config),
      { addPlugin: rs.fn(), removePlugin: rs.fn() },
      false
    );

    const pluginCount =
      result?.builderConfig?.plugins?.filter(
        (p: unknown) => (p as { name?: string }).name === 'mock-rsbuild-plugin'
      ).length ?? 0;
    expect(pluginCount).toBe(2);
  });

  // rspress v1 compatibility tests
  describe('rspress v1 compatibility', () => {
    it('should use builderPlugins for rspress v1 config', async () => {
      const addPlugin = rs.fn();
      const removePlugin = rs.fn();
      const config = {
        ssg: false,
        builderPlugins: [],
      };

      const plugin = withZephyr();
      const result = await plugin.config?.(
        asConfig(config),
        { addPlugin, removePlugin },
        false
      );

      expect(rsbuildPluginMock).toHaveBeenCalled();
      expect(result?.builderPlugins).toContainEqual({
        name: 'mock-rsbuild-plugin',
      });
      expect(result?.builderConfig).toBeUndefined();
      expect(addPlugin).not.toHaveBeenCalled();
    });

    it('should preserve existing builderPlugins in v1 config', async () => {
      const existingPlugin = { name: 'existing-plugin' };
      const config = {
        ssg: false,
        builderPlugins: [existingPlugin],
      };

      const plugin = withZephyr();
      const result = await plugin.config?.(
        asConfig(config),
        { addPlugin: rs.fn(), removePlugin: rs.fn() },
        false
      );

      expect(result?.builderPlugins).toContainEqual(existingPlugin);
      expect(result?.builderPlugins).toContainEqual({
        name: 'mock-rsbuild-plugin',
      });
      expect(result?.builderPlugins?.length).toBe(2);
    });
  });

  // SSG config as object tests (rspress v2 supports object-based ssg config)
  describe('ssg object config', () => {
    beforeEach(() => {
      // Reset mock to default behavior after error test
      rspressPluginMock.mockImplementation((..._args: unknown[]) => ({
        name: 'mock-ssg-plugin',
      }));
    });

    it('should enable SSG plugin when ssg is an object', async () => {
      const addPlugin = rs.fn();
      const config = {
        ssg: { experimentalWorker: true },
        outDir: 'dist',
      };

      const plugin = withZephyr();
      const result = await plugin.config?.(
        asConfig(config),
        { addPlugin, removePlugin: rs.fn() },
        false
      );

      expect(rspressPluginMock).toHaveBeenCalledWith(config, { mfConfig: [] });
      expect(addPlugin).toHaveBeenCalledWith({ name: 'mock-ssg-plugin' });
      expect(result?.builderConfig?.plugins).toContain(portableFederationPlugin);
      expect(result).toEqual(config);
    });

    it('should not enable SSG plugin when ssg is undefined', async () => {
      const addPlugin = rs.fn();
      const config = {
        outDir: 'dist',
      };

      const plugin = withZephyr();
      await plugin.config?.(
        asConfig(config),
        { addPlugin, removePlugin: rs.fn() },
        false
      );

      expect(rsbuildPluginMock).toHaveBeenCalled();
      expect(addPlugin).not.toHaveBeenCalled();
    });
  });
});

describe('withZephyr with ZE_DISABLED=true', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    process.env['ZE_DISABLED'] = 'true';
  });

  afterEach(() => {
    delete process.env['ZE_DISABLED'];
    rs.restoreAllMocks();
  });

  it('keeps option validation first', () => {
    expect(() => withZephyr({ target: 'desktop' as never })).toThrow(
      'withZephyr({ target }) must be one of'
    );
  });

  it('adds an inert SSG hook that only says the bundle was not deployed', async () => {
    const warn = rs.spyOn(console, 'warn').mockImplementation(() => undefined);
    const addPlugin = rs.fn();
    const config = { ssg: true, outDir: 'dist' };

    const result = await withZephyr().config?.(
      asConfig(config),
      { addPlugin, removePlugin: rs.fn() },
      false
    );

    expect(result).toBe(config);
    expect(result).not.toHaveProperty('builderConfig');
    expect(rspressPluginMock).not.toHaveBeenCalled();
    expect(addPlugin).toHaveBeenCalledTimes(1);
    const hook = addPlugin.mock.calls[0]?.[0];
    expect(warn).not.toHaveBeenCalled();

    await hook.afterBuild();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toContain('Zephyr is disabled (ZE_DISABLED)');
  });

  it('leaves the Rsbuild plugin, which has its own skip mode, for plain builds', async () => {
    const config = { ssg: false, builderConfig: { plugins: [] } };

    const result = await withZephyr().config?.(
      asConfig(config),
      { addPlugin: rs.fn(), removePlugin: rs.fn() },
      false
    );

    expect(rspressPluginMock).not.toHaveBeenCalled();
    expect(result?.builderConfig?.plugins).toEqual([{ name: 'mock-rsbuild-plugin' }]);
  });
});
