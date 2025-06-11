import path from 'node:path';
import { ZephyrEngine, logFn } from 'zephyr-agent';
import { setupZeDeploy } from '../internal/assets/setupZeDeploy';
import { showFiles } from '../internal/files/showFiles';
import { walkFiles } from '../internal/files/walkFiles';
import { zephyrRspressSSGPlugin } from '../zephyrRspressSSGPlugin';

jest.mock('zephyr-agent', () => {
  const actual = jest.requireActual('zephyr-agent');
  return {
    ...actual,
    ZephyrEngine: {
      defer_create: jest.fn(),
    },
    ze_log: {
      upload: jest.fn(),
    },
    logFn: jest.fn(),
    ZephyrError: {
      format: jest.fn((err) => `Formatted: ${err.message}`),
    },
  };
});

jest.mock('../internal/files/walkFiles', () => ({
  walkFiles: jest.fn(),
}));

jest.mock('../internal/files/showFiles', () => ({
  showFiles: jest.fn(),
}));

jest.mock('../internal/assets/setupZeDeploy', () => ({
  setupZeDeploy: jest.fn(),
}));

describe('zephyrRspressSSGPlugin', () => {
  const mockZephyrDefer = jest.fn();
  const mockEngine = Promise.resolve({ engine: 'mock' });

  beforeEach(() => {
    jest.clearAllMocks();

    (ZephyrEngine.defer_create as jest.Mock).mockReturnValue({
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
    (walkFiles as jest.Mock).mockResolvedValue(mockFiles);

    const plugin = zephyrRspressSSGPlugin({ outDir: 'dist' });
    await plugin.afterBuild?.({}, false);

    expect(showFiles).toHaveBeenCalledWith(path.resolve('dist'), mockFiles);
    expect(setupZeDeploy).toHaveBeenCalledWith({
      deferEngine: mockEngine,
      outDir: path.resolve('dist'),
      files: mockFiles,
    });
  });

  it('should log error using logFn if afterBuild throws', async () => {
    const err = new Error('walk failed');
    (walkFiles as jest.Mock).mockRejectedValue(err);

    const plugin = zephyrRspressSSGPlugin({ outDir: 'dist' });
    await plugin.afterBuild?.({}, false);

    expect(logFn).toHaveBeenCalledWith('error', 'Formatted: walk failed');
  });
});
