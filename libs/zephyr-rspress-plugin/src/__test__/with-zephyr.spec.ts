import { beforeEach, describe, expect, it, rs } from '@rstest/core';

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { withZephyr } from '../with-zephyr';

const rspressPluginMock = rs.fn((_: any) => ({ name: 'mock-ssg-plugin' }));

rs.mock('../zephyrRspressSSGPlugin', () => ({
  zephyrRspressSSGPlugin: (...args: any[]) => rspressPluginMock(...args),
}));

const rsbuildPluginMock = rs.fn(() => ({ name: 'mock-rsbuild-plugin' }));
const portableFederationPlugin = { name: 'mock-mf-public-path-plugin' };
let onModuleFederationPlugins: ((plugins: any[]) => void) | undefined;
const moduleFederationPublicPathPluginMock = rs.fn((options?: any) => {
  onModuleFederationPlugins = options?.onModuleFederationPlugins;
  return portableFederationPlugin;
});

rs.mock('../internal/assets/moduleFederationPublicPathPlugin', () => ({
  moduleFederationPublicPathPlugin: (...args: any[]) =>
    moduleFederationPublicPathPluginMock(...args),
}));

rs.mock('zephyr-rsbuild-plugin', () => ({
  withZephyr: (...args: any[]) => rsbuildPluginMock(...args),
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

  it('should add the zephyrRspressSSGPlugin when ssg is true', async () => {
    const addPlugin = rs.fn();
    const plugin = withZephyr();
    const config = {
      ssg: true,
      outDir: 'dist',
    };

    const removePlugin = rs.fn();
    const result = await plugin.config?.(
      config as any,
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
      config as any,
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
      ssgConfig as any,
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
      builderConfig as any,
      { addPlugin: rs.fn(), removePlugin: rs.fn() },
      false
    );
    expect(rsbuildPluginMock).toHaveBeenCalledWith({ target: 'tap-app' });
  });

  it('retains every SSG compiler federation plugin for publication', async () => {
    const config = { ssg: true, outDir: 'dist' };
    await withZephyr({ target: 'tap-app' }).config?.(
      config as any,
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
      config as any,
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
      plugin.config?.(config as any, { addPlugin, removePlugin }, false)
    ).rejects.toThrow('SSG plugin failed');
  });

  it('should handle undefined config gracefully', async () => {
    const addPlugin = rs.fn();
    const removePlugin = rs.fn();
    const config = {};

    const plugin = withZephyr();
    const result = await plugin.config?.(
      config as any,
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
      config as any,
      { addPlugin: rs.fn(), removePlugin: rs.fn() },
      false
    );

    const pluginCount =
      result?.builderConfig?.plugins?.filter(
        (p: { name: string }) => p.name === 'mock-rsbuild-plugin'
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
        config as any,
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
        config as any,
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
      rspressPluginMock.mockImplementation((_: any) => ({ name: 'mock-ssg-plugin' }));
    });

    it('should enable SSG plugin when ssg is an object', async () => {
      const addPlugin = rs.fn();
      const config = {
        ssg: { experimentalWorker: true },
        outDir: 'dist',
      };

      const plugin = withZephyr();
      const result = await plugin.config?.(
        config as any,
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
      await plugin.config?.(config as any, { addPlugin, removePlugin: rs.fn() }, false);

      expect(rsbuildPluginMock).toHaveBeenCalled();
      expect(addPlugin).not.toHaveBeenCalled();
    });
  });
});
