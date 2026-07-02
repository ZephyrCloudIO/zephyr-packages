import { rs } from '@rstest/core';
import path from 'node:path';
import { ZephyrEngine, logFn } from 'zephyr-agent';
import { setupZeDeploy } from '../internal/assets/setupZeDeploy';
import { showFiles } from '../internal/files/showFiles';
import { walkFiles } from '../internal/files/walkFiles';
import { zephyrRspressSSGPlugin } from '../zephyrRspressSSGPlugin';

rs.mock('zephyr-agent', () => {
  return {
    ZephyrEngine: {
      defer_create: rs.fn(),
    },
    ze_log: {
      upload: rs.fn(),
    },
    logFn: rs.fn(),
    ZephyrError: {
      format: rs.fn((err) => `Formatted: ${err.message}`),
    },
  };
});

rs.mock('../internal/files/walkFiles', () => ({
  walkFiles: rs.fn(),
}));

rs.mock('../internal/files/showFiles', () => ({
  showFiles: rs.fn(),
}));

rs.mock('../internal/assets/setupZeDeploy', () => ({
  setupZeDeploy: rs.fn(),
}));

describe('zephyrRspressSSGPlugin', () => {
  const mockZephyrDefer = rs.fn();
  const mockEngine = Promise.resolve({ engine: 'mock' });

  beforeEach(() => {
    rs.clearAllMocks();

    (ZephyrEngine.defer_create as rs.Mock).mockReturnValue({
      zephyr_engine_defer: mockEngine,
      zephyr_defer_create: mockZephyrDefer,
    });
  });

  it('should call zephyr_defer_create with correct context', () => {
    zephyrRspressSSGPlugin({ outDir: 'custom-out' });

    expect(ZephyrEngine.defer_create).toHaveBeenCalled();
    expect(mockZephyrDefer).toHaveBeenCalledWith({
      builder: 'rspack',
      context: path.resolve(),
    });
  });

  it('should show files and run setupZeDeploy if files are found', async () => {
    const mockFiles = ['index.html', 'main.js'];
    (walkFiles as rs.Mock).mockResolvedValue(mockFiles);

    const plugin = zephyrRspressSSGPlugin({ outDir: 'dist' });
    await plugin.afterBuild?.();

    expect(showFiles).toHaveBeenCalledWith(path.resolve('dist'), mockFiles);
    expect(setupZeDeploy).toHaveBeenCalledWith({
      deferEngine: mockEngine,
      outDir: path.resolve('dist'),
      files: mockFiles,
    });
  });

  it('should log error using logFn if afterBuild throws', async () => {
    const err = new Error('walk failed');
    (walkFiles as rs.Mock).mockRejectedValue(err);

    const plugin = zephyrRspressSSGPlugin({ outDir: 'dist' });
    await plugin.afterBuild?.();

    expect(logFn).toHaveBeenCalledWith('error', 'Formatted: walk failed');
  });
});
