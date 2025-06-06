/* eslint-disable @typescript-eslint/no-explicit-any */
import { zephyrRsbuildPlugin } from '../zephyrRsbuildPlugin';
import { withZephyr } from 'zephyr-rspack-plugin';

jest.mock('zephyr-rspack-plugin', () => ({
  withZephyr: jest.fn(() => jest.fn()),
}));

describe('zephyrRsbuildPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return a valid RsbuildPlugin with correct name', () => {
    const plugin = zephyrRsbuildPlugin();

    expect(plugin).toHaveProperty('name', 'zephyr-rsbuild-plugin');
    expect(plugin).toHaveProperty('setup');
    expect(typeof plugin.setup).toBe('function');
  });

  it('should call withZephyr during modifyRspackConfig', async () => {
    const mockWithZephyrImpl = jest.fn().mockResolvedValue(undefined);
    (withZephyr as jest.Mock).mockReturnValue(mockWithZephyrImpl);

    interface ModifyRspackConfigFn {
      (config: Record<string, unknown>): Promise<void>;
    }

    interface Api {
      modifyRspackConfig: (fn: ModifyRspackConfigFn) => Promise<void>;
    }

    const api: Api = {
      modifyRspackConfig: async (fn: ModifyRspackConfigFn): Promise<void> => {
        await fn({});
      },
    };

    const plugin = zephyrRsbuildPlugin();
    await plugin.setup(api as any);

    expect(mockWithZephyrImpl).toHaveBeenCalledWith({});
  });
});
