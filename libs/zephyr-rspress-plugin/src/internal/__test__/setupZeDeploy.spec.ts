/* eslint-disable @typescript-eslint/no-explicit-any */
import { ze_log } from 'zephyr-agent';
import { xpack_zephyr_agent } from 'zephyr-xpack-internal';
import { buildAssetMapFromFiles } from '../assets/buildAssets';
import { setupZeDeploy } from '../assets/setupZeDeploy';
import { buildStats } from '../stats/buildStats';

jest.mock('zephyr-xpack-internal', () => ({
  xpack_zephyr_agent: jest.fn(),
}));

jest.mock('../assets/buildAssets', () => ({
  buildAssetMapFromFiles: jest.fn(),
}));

jest.mock('../stats/buildStats', () => ({
  buildStats: jest.fn(),
}));

jest.mock('zephyr-agent', () => ({
  ze_log: {
    package: jest.fn(),
  },
}));

// @ts-expect-error Get reference to ze_log.package mock
const mockedZeLog = ze_log.package as jest.Mock;

describe('setupZeDeploy', () => {
  const mockAssets = { 'file.js': { type: 'asset', size: 123 } };
  const mockStats = {
    toJson: jest.fn().mockReturnValue({ some: 'json' }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (buildAssetMapFromFiles as jest.Mock).mockResolvedValue(mockAssets);
    (buildStats as jest.Mock).mockReturnValue(mockStats);
  });

  it('should log and return early if no files are provided', async () => {
    await setupZeDeploy({
      deferEngine: Promise.resolve({ engine: 'mock' } as any),
      outDir: '/doc_build',
      files: [],
    });

    expect(mockedZeLog).toHaveBeenCalledWith('ZeRspressPlugin: No files to process.');
    expect(buildAssetMapFromFiles).not.toHaveBeenCalled();
    expect(buildStats).not.toHaveBeenCalled();
    expect(xpack_zephyr_agent).not.toHaveBeenCalled();
  });

  it('should build assets and stats and call xpack_zephyr_agent', async () => {
    await setupZeDeploy({
      deferEngine: Promise.resolve({ engine: 'mock' } as any),
      outDir: '/doc_build',
      files: ['index.html', 'main.js'],
    });

    await new Promise(process.nextTick); // Allow promises to resolve

    expect(buildAssetMapFromFiles).toHaveBeenCalledWith('/doc_build', [
      'index.html',
      'main.js',
    ]);
    expect(buildStats).toHaveBeenCalledWith('/doc_build', ['index.html', 'main.js']);
    expect(xpack_zephyr_agent).toHaveBeenCalledWith({
      stats: mockStats,
      stats_json: { some: 'json' },
      assets: mockAssets,
      pluginOptions: {
        pluginName: 'rspress-ssg',
        zephyr_engine: { engine: 'mock' },
        options: {},
      },
    });
  });
});
