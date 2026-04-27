import { rs } from '@rstest/core';
import path from 'node:path';
import { zephyrRspressSSGPlugin } from '../zephyrRspressSSGPlugin';

const deferCreateMock = rs.fn();
const logFnMock = rs.fn();
const zeLogUploadMock = rs.fn();
const zephyrErrorFormatMock = rs.fn(
  (err: Error) => `Formatted: ${err.message}`
);
const walkFilesMock = rs.fn();
const showFilesMock = rs.fn();
const setupZeDeployMock = rs.fn();

rs.mock('zephyr-agent', () => ({
  ZephyrEngine: {
    defer_create: (...args: unknown[]) => deferCreateMock(...args),
  },
  ze_log: {
    upload: (...args: unknown[]) => zeLogUploadMock(...args),
  },
  logFn: (...args: unknown[]) => logFnMock(...args),
  ZephyrError: {
    format: (...args: unknown[]) => zephyrErrorFormatMock(...args),
  },
}));

rs.mock('../internal/files/walkFiles', () => ({
  walkFiles: (...args: unknown[]) => walkFilesMock(...args),
}));

rs.mock('../internal/files/showFiles', () => ({
  showFiles: (...args: unknown[]) => showFilesMock(...args),
}));

rs.mock('../internal/assets/setupZeDeploy', () => ({
  setupZeDeploy: (...args: unknown[]) => setupZeDeployMock(...args),
}));

describe('zephyrRspressSSGPlugin', () => {
  const mockZephyrDefer = rs.fn();
  const mockEngine = Promise.resolve({ engine: 'mock' });

  beforeEach(() => {
    rs.clearAllMocks();

    deferCreateMock.mockReturnValue({
      zephyr_engine_defer: mockEngine,
      zephyr_defer_create: mockZephyrDefer,
    });
  });

  it('should call zephyr_defer_create with correct context', () => {
    zephyrRspressSSGPlugin({ outDir: 'custom-out' });

    expect(deferCreateMock).toHaveBeenCalled();
    expect(mockZephyrDefer).toHaveBeenCalledWith({
      builder: 'rspack',
      context: path.resolve(),
    });
  });

  it('should show files and run setupZeDeploy if files are found', async () => {
    const mockFiles = ['index.html', 'main.js'];
    walkFilesMock.mockResolvedValue(mockFiles);

    const plugin = zephyrRspressSSGPlugin({ outDir: 'dist' });
    await plugin.afterBuild?.();

    expect(showFilesMock).toHaveBeenCalledWith(path.resolve('dist'), mockFiles);
    expect(setupZeDeployMock).toHaveBeenCalledWith({
      deferEngine: mockEngine,
      outDir: path.resolve('dist'),
      files: mockFiles,
      hooks: undefined,
    });
  });

  it('should log error using logFn if afterBuild throws', async () => {
    const err = new Error('walk failed');
    walkFilesMock.mockRejectedValue(err);

    const plugin = zephyrRspressSSGPlugin({ outDir: 'dist' });
    await plugin.afterBuild?.();

    expect(logFnMock).toHaveBeenCalledWith('error', 'Formatted: walk failed');
  });
});
