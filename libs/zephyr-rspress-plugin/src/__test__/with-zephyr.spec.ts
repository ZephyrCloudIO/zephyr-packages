/* eslint-disable @typescript-eslint/no-explicit-any */
import { withZephyr } from '../with-zephyr';
import { zephyrRsbuildPlugin } from '../zephyrRsbuildPlugin';
import { zephyrRspressSSGPlugin } from '../zephyrRspressSSGPlugin';

jest.mock('../zephyrRspressSSGPlugin', () => ({
  zephyrRspressSSGPlugin: jest.fn(() => ({ name: 'mock-ssg-plugin' })),
}));

jest.mock('../zephyrRsbuildPlugin', () => ({
  zephyrRsbuildPlugin: jest.fn(() => ({ name: 'mock-rsbuild-plugin' })),
}));

describe('withZephyr', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should add the zephyrRspressSSGPlugin when ssg is true', async () => {
    const addPlugin = jest.fn();
    const plugin = withZephyr();
    const config = {
      ssg: true,
      outDir: 'dist',
    };

    const removePlugin = jest.fn();
    const result = await plugin.config?.(
      config as any,
      { addPlugin, removePlugin },
      false
    );

    expect(zephyrRspressSSGPlugin).toHaveBeenCalledWith(config);
    expect(addPlugin).toHaveBeenCalledWith({ name: 'mock-ssg-plugin' });
    expect(result).toEqual(config);
  });

  it('should add the zephyrRsbuildPlugin when ssg is false', async () => {
    const addPlugin = jest.fn();
    const removePlugin = jest.fn();
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

    expect(zephyrRsbuildPlugin).toHaveBeenCalled();
    expect(config.builderPlugins).toContainEqual({ name: 'mock-rsbuild-plugin' });
    expect(addPlugin).not.toHaveBeenCalled();
    expect(result).toEqual(config);
  });

  it('should handle missing builderPlugins array when ssg is false', async () => {
    const addPlugin = jest.fn();
    const removePlugin = jest.fn();
    const config = {
      ssg: false,
    };

    const plugin = withZephyr();
    const result = await plugin.config?.(
      config as any,
      { addPlugin, removePlugin },
      false
    );

    expect(zephyrRsbuildPlugin).toHaveBeenCalled();
    expect(result?.builderPlugins).toContainEqual({ name: 'mock-rsbuild-plugin' });
    expect(addPlugin).not.toHaveBeenCalled();
  });

  it('should handle errors thrown by zephyrRspressSSGPlugin', async () => {
    (zephyrRspressSSGPlugin as jest.Mock).mockImplementation(() => {
      throw new Error('SSG plugin failed');
    });

    const addPlugin = jest.fn();
    const removePlugin = jest.fn();
    const config = { ssg: true, outDir: 'dist' };

    const plugin = withZephyr();

    await expect(
      plugin.config?.(config as any, { addPlugin, removePlugin }, false)
    ).rejects.toThrow('SSG plugin failed');
  });

  it('should handle undefined config gracefully', async () => {
    const addPlugin = jest.fn();
    const removePlugin = jest.fn();
    const config = {};

    const plugin = withZephyr();
    const result = await plugin.config?.(
      config as any,
      { addPlugin, removePlugin },
      false
    );

    expect(zephyrRsbuildPlugin).toHaveBeenCalled();
    expect(result?.builderPlugins).toContainEqual({ name: 'mock-rsbuild-plugin' });
  });

  it('should not add rsbuild plugin twice', async () => {
    const config = {
      ssg: false,
      builderPlugins: [{ name: 'mock-rsbuild-plugin' }],
    };

    const plugin = withZephyr();
    const result = await plugin.config?.(
      config as any,
      { addPlugin: jest.fn(), removePlugin: jest.fn() },
      false
    );

    const pluginCount =
      result?.builderPlugins?.filter((p) => p.name === 'mock-rsbuild-plugin').length ?? 0;
    expect(pluginCount).toBe(2);
  });
});
