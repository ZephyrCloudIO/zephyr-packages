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

  it('rejects an unsupported untyped target before creating an SSG engine', () => {
    expect(() =>
      zephyrRspressSSGPlugin({ outDir: 'custom-out' }, { target: 'desktop' as never })
    ).toThrow('zephyrRspressSSGPlugin({ target }) must be one of');
    expect(ZephyrEngine.defer_create).not.toHaveBeenCalled();
  });

  it('forwards tap-app through the SSG engine creation path', () => {
    zephyrRspressSSGPlugin({ outDir: 'custom-out' }, { target: 'tap-app' });

    expect(mockZephyrDefer).toHaveBeenCalledWith({
      builder: 'rspack',
      context: path.resolve(),
      target: 'tap-app',
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

  it('preserves SDK-locked tap-app output by skipping the Rspress rewrite', async () => {
    const mockFiles = ['manifest.tap.json', 'targets/desktop/remoteEntry.mjs'];
    (walkFiles as Mock).mockResolvedValue(mockFiles);

    const plugin = zephyrRspressSSGPlugin({ outDir: 'dist' }, { target: 'tap-app' });
    await plugin.afterBuild?.();

    expect(rewriteRspressModuleFederationAssets).not.toHaveBeenCalled();
    expect(walkFiles).toHaveBeenCalledWith(path.resolve('dist'), '', 'tap-app');
    expect(showFiles).toHaveBeenCalledWith(path.resolve('dist'), mockFiles);
    expect(setupZeDeploy).toHaveBeenCalledWith({
      deferEngine: mockEngine,
      outDir: path.resolve('dist'),
      files: mockFiles,
    });
  });

  it('forwards every federation configuration to the SSG deployment', async () => {
    const mockFiles = ['manifest.tap.json', 'targets/desktop/remoteEntry.mjs'];
    const mfConfig = [
      {
        name: 'RspackModuleFederationPlugin',
        apply() {},
        _options: { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
      },
      {
        name: 'RspackModuleFederationPlugin',
        apply() {},
        _options: { name: 'worker', filename: 'targets/worker/remoteEntry.mjs' },
      },
    ];
    (walkFiles as Mock).mockResolvedValue(mockFiles);

    const plugin = zephyrRspressSSGPlugin(
      { outDir: 'dist' },
      { target: 'tap-app', mfConfig }
    );
    await plugin.afterBuild?.();

    expect(setupZeDeploy).toHaveBeenCalledWith(
      expect.objectContaining({
        deferEngine: mockEngine,
        outDir: path.resolve('dist'),
        files: mockFiles,
        mfConfig,
      })
    );
  });

  it('routes afterBuild failures through the global error policy', async () => {
    const err = new Error('walk failed');
    (walkFiles as Mock).mockRejectedValue(err);

    const plugin = zephyrRspressSSGPlugin({ outDir: 'dist' });
    await plugin.afterBuild?.();

    expect(handleGlobalError).toHaveBeenCalledWith(err);
  });
});
