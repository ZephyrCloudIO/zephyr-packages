/* eslint-disable @typescript-eslint/no-explicit-any */
import { rs } from '@rstest/core';
import { setupZeDeploy } from '../assets/setupZeDeploy';

const xpackZephyrAgentMock = rs.fn();
const buildAssetMapFromFilesMock = rs.fn();
const buildStatsMock = rs.fn();
const zeLogPackageMock = rs.fn();

rs.mock('zephyr-xpack-internal', () => ({
  xpack_zephyr_agent: (...args: unknown[]) => xpackZephyrAgentMock(...args),
}));

rs.mock('../assets/buildAssets', () => ({
  buildAssetMapFromFiles: (...args: unknown[]) =>
    buildAssetMapFromFilesMock(...args),
}));

rs.mock('../stats/buildStats', () => ({
  buildStats: (...args: unknown[]) => buildStatsMock(...args),
}));

rs.mock('zephyr-agent', () => ({
  ze_log: {
    package: (...args: unknown[]) => zeLogPackageMock(...args),
  },
}));

describe('setupZeDeploy', () => {
  const mockAssets = { 'file.js': { type: 'asset', size: 123 } };
  const mockStats = {
    toJson: rs.fn().mockReturnValue({ some: 'json' }),
  };

  beforeEach(() => {
    rs.clearAllMocks();
    buildAssetMapFromFilesMock.mockResolvedValue(mockAssets);
    buildStatsMock.mockReturnValue(mockStats);
  });

  it('should log and return early if no files are provided', async () => {
    await setupZeDeploy({
      deferEngine: Promise.resolve({ engine: 'mock' } as any),
      outDir: '/doc_build',
      files: [],
    });

    expect(zeLogPackageMock).toHaveBeenCalledWith(
      'ZeRspressPlugin: No files to process.'
    );
    expect(buildAssetMapFromFilesMock).not.toHaveBeenCalled();
    expect(buildStatsMock).not.toHaveBeenCalled();
    expect(xpackZephyrAgentMock).not.toHaveBeenCalled();
  });

  it('should build assets and stats and call xpack_zephyr_agent', async () => {
    await setupZeDeploy({
      deferEngine: Promise.resolve({ engine: 'mock' } as any),
      outDir: '/doc_build',
      files: ['index.html', 'main.js'],
    });

    await new Promise(process.nextTick);

    expect(buildAssetMapFromFilesMock).toHaveBeenCalledWith('/doc_build', [
      'index.html',
      'main.js',
    ]);
    expect(buildStatsMock).toHaveBeenCalledWith('/doc_build', [
      'index.html',
      'main.js',
    ]);
    expect(xpackZephyrAgentMock).toHaveBeenCalledWith({
      stats: mockStats,
      stats_json: { some: 'json' },
      assets: mockAssets,
      pluginOptions: {
        pluginName: 'rspress-ssg',
        zephyr_engine: { engine: 'mock' },
        options: {},
        hooks: undefined,
      },
    });
  });
});
