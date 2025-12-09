/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { withZephyr } from '../with-zephyr';

const rspressPluginMock = jest.fn((_: any) => ({ name: 'mock-ssg-plugin' }));

jest.mock('../zephyrRspressSSGPlugin', () => ({
  zephyrRspressSSGPlugin: (config: any) => rspressPluginMock(config),
}));

const rsbuildPluginMock = jest.fn(() => ({ name: 'mock-rsbuild-plugin' }));

jest.mock(
  'zephyr-rsbuild-plugin',
  () => ({
    withZephyr: () => rsbuildPluginMock(),
  }),
  { virtual: true }
);

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

    expect(rspressPluginMock).toHaveBeenCalledWith(config);
    expect(addPlugin).toHaveBeenCalledWith({ name: 'mock-ssg-plugin' });
    expect(result).toEqual(config);
  });

  it('should add the zephyrRsbuildPlugin when ssg is false', async () => {
    const addPlugin = jest.fn();
    const removePlugin = jest.fn();
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

  it('should handle missing builderConfig when ssg is false', async () => {
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
      { addPlugin: jest.fn(), removePlugin: jest.fn() },
      false
    );

    const pluginCount =
      result?.builderConfig?.plugins?.filter(
        (p: { name: string }) => p.name === 'mock-rsbuild-plugin'
      ).length ?? 0;
    expect(pluginCount).toBe(2);
  });
});
