import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

import path from 'node:path';
import { ZephyrEngine, handleGlobalError } from 'zephyr-agent';
import { setupZeDeploy } from '../internal/assets/setupZeDeploy';
import { rewriteRspressModuleFederationAssets } from '../internal/assets/rewriteRspressModuleFederationAssets';
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
    handleGlobalError: rs.fn(),
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

rs.mock('../internal/assets/rewriteRspressModuleFederationAssets', () => ({
  rewriteRspressModuleFederationAssets: rs.fn(),
}));

describe('zephyrRspressSSGPlugin', () => {
  const mockZephyrDefer = rs.fn();
  const mockEngine = Promise.resolve({ engine: 'mock' });

  beforeEach(() => {
    rs.clearAllMocks();

    (ZephyrEngine.defer_create as Mock).mockReturnValue({
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
    (walkFiles as Mock).mockResolvedValue(mockFiles);

    const plugin = zephyrRspressSSGPlugin({ outDir: 'dist' });
    await plugin.afterBuild?.();

    expect(rewriteRspressModuleFederationAssets).toHaveBeenCalledWith(
      path.resolve('dist'),
      mockFiles
    );
    expect(showFiles).toHaveBeenCalledWith(path.resolve('dist'), mockFiles);
    expect(setupZeDeploy).toHaveBeenCalledWith({
      deferEngine: mockEngine,
      outDir: path.resolve('dist'),
      files: mockFiles,
    });
  });

  it('routes afterBuild failures through the global error policy', async () => {
    const err = new Error('walk failed');
    (walkFiles as Mock).mockRejectedValue(err);

    const plugin = zephyrRspressSSGPlugin({ outDir: 'dist' });
    await plugin.afterBuild?.();

    expect(handleGlobalError).toHaveBeenCalledWith(err);
  });
});
