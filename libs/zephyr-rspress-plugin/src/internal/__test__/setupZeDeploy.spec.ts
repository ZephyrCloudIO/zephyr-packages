import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { ze_log } from 'zephyr-agent';
import { xpack_zephyr_agent } from 'zephyr-xpack-internal';
import { buildAssetMapFromFiles } from '../assets/buildAssets';
import { setupZeDeploy } from '../assets/setupZeDeploy';
import { buildStats } from '../stats/buildStats';

rs.mock('zephyr-xpack-internal', () => ({
  xpack_zephyr_agent: rs.fn(),
}));

rs.mock('../assets/buildAssets', () => ({
  buildAssetMapFromFiles: rs.fn(),
}));

rs.mock('../stats/buildStats', () => ({
  buildStats: rs.fn(),
}));

rs.mock('zephyr-agent', () => ({
  ze_log: {
    package: rs.fn(),
  },
}));

// @ts-expect-error Get reference to ze_log.package mock
const mockedZeLog = ze_log.package as Mock;

describe('setupZeDeploy', () => {
  const mockAssets = { 'file.js': { type: 'asset', size: 123 } };
  const mockStats = {
    toJson: rs.fn().mockReturnValue({ some: 'json' }),
  };
  const mockEngine = {
    start_new_build: rs.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    rs.clearAllMocks();
    mockEngine.start_new_build.mockResolvedValue(undefined);
    (buildAssetMapFromFiles as Mock).mockResolvedValue(mockAssets);
    (buildStats as Mock).mockReturnValue(mockStats);
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
      deferEngine: Promise.resolve(mockEngine as any),
      outDir: '/doc_build',
      files: ['index.html', 'main.js'],
    });

    expect(buildAssetMapFromFiles).toHaveBeenCalledWith('/doc_build', [
      'index.html',
      'main.js',
    ]);
    expect(buildStats).toHaveBeenCalledWith('/doc_build', ['index.html', 'main.js']);
    expect(mockEngine.start_new_build).toHaveBeenCalledTimes(1);
    expect(xpack_zephyr_agent).toHaveBeenCalledWith({
      stats: mockStats,
      stats_json: { some: 'json' },
      assets: mockAssets,
      pluginOptions: {
        pluginName: 'rspress-ssg',
        zephyr_engine: mockEngine,
        options: {},
      },
    });
  });

  it('should propagate upload failures', async () => {
    (xpack_zephyr_agent as Mock).mockRejectedValueOnce(new Error('deploy failed'));

    await expect(
      setupZeDeploy({
        deferEngine: Promise.resolve(mockEngine as any),
        outDir: '/doc_build',
        files: ['index.html', 'main.js'],
      })
    ).rejects.toThrow('deploy failed');
  });

  it('rolls back when a repeated build cannot allocate fresh state', async () => {
    const startFailure = new Error('build ID failed');
    const engine = {
      hasActiveBuild: true,
      start_new_build: rs.fn().mockRejectedValue(startFailure),
      build_failed: rs.fn(),
    };

    await expect(
      setupZeDeploy({
        deferEngine: Promise.resolve(engine as any),
        outDir: '/doc_build',
        files: ['index.html'],
      })
    ).rejects.toBe(startFailure);

    expect(engine.build_failed).toHaveBeenCalledTimes(1);
    expect(xpack_zephyr_agent).not.toHaveBeenCalled();
  });
});
