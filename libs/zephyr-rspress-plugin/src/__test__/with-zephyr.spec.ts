/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { rs } from '@rstest/core';
import { withZephyr } from '../with-zephyr';

const rspressPluginMock = rs.fn((_: any) => ({ name: 'mock-ssg-plugin' }));
const rsbuildPluginMock = rs.fn(() => ({ name: 'mock-rsbuild-plugin' }));

rs.mock('../zephyrRspressSSGPlugin', () => ({
  zephyrRspressSSGPlugin: (...args: unknown[]) => rspressPluginMock(...args),
}));

rs.mock(
  'zephyr-rsbuild-plugin',
  () => ({
    withZephyr: () => rsbuildPluginMock(),
  })
);

describe('withZephyr', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    rspressPluginMock.mockImplementation((_: any) => ({ name: 'mock-ssg-plugin' }));
    rsbuildPluginMock.mockImplementation(() => ({ name: 'mock-rsbuild-plugin' }));
  });

  it('should add the zephyrRspressSSGPlugin when ssg is true', async () => {
    const addPlugin = rs.fn();
    const plugin = withZephyr();
    const config = {
      ssg: true,
      outDir: 'dist',
    };

    const removePlugin = rs.fn();
    const result = await plugin.config?.(config as any, { addPlugin, removePlugin }, false);

    expect(rspressPluginMock).toHaveBeenCalledWith(config, undefined);
    expect(addPlugin).toHaveBeenCalledWith({ name: 'mock-ssg-plugin' });
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
    const result = await plugin.config?.(config as any, { addPlugin, removePlugin }, false);

    expect(rsbuildPluginMock).toHaveBeenCalled();
    expect(result?.builderConfig?.plugins).toContainEqual({
      name: 'mock-rsbuild-plugin',
    });
    expect(addPlugin).not.toHaveBeenCalled();
  });

  it('should handle missing builderConfig when ssg is false', async () => {
    const addPlugin = rs.fn();
    const removePlugin = rs.fn();
    const config = {
      ssg: false,
    };

    const plugin = withZephyr();
    const result = await plugin.config?.(config as any, { addPlugin, removePlugin }, false);

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
    const result = await plugin.config?.(config as any, { addPlugin, removePlugin }, false);

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

  describe('rspress v1 compatibility', () => {
    it('should use builderPlugins for rspress v1 config', async () => {
      const addPlugin = rs.fn();
      const removePlugin = rs.fn();
      const config = {
        ssg: false,
        builderPlugins: [],
      };

      const plugin = withZephyr();
      const result = await plugin.config?.(config as any, { addPlugin, removePlugin }, false);

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

  describe('ssg object config', () => {
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

      expect(rspressPluginMock).toHaveBeenCalledWith(config, undefined);
      expect(addPlugin).toHaveBeenCalledWith({ name: 'mock-ssg-plugin' });
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
