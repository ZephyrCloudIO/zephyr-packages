import { rs } from '@rstest/core';
import { resolve } from 'node:path';
import { createUploadRunner, resolveAssetSources } from './ssr-upload';
import type { NuxtLike } from './types';

const {
  mockedBuildAssetsMap,
  mockedHandleGlobalError,
  mockedReadDirRecursiveWithContents,
  mockedZeBuildDashData,
} = rs.hoisted(() => ({
  mockedBuildAssetsMap: rs.fn(),
  mockedHandleGlobalError: rs.fn(),
  mockedReadDirRecursiveWithContents: rs.fn(),
  mockedZeBuildDashData: rs.fn(),
}));

rs.mock('zephyr-agent', () => ({
  buildAssetsMap: mockedBuildAssetsMap,
  handleGlobalError: mockedHandleGlobalError,
  readDirRecursiveWithContents: mockedReadDirRecursiveWithContents,
  zeBuildDashData: mockedZeBuildDashData,
  ze_log: {
    upload: rs.fn(),
  },
}));

function makeNuxt(rootDir: string, publicDir?: string): NuxtLike {
  return {
    options: {
      rootDir,
      dev: false,
      nitro: {
        output: {
          dir: '.output',
          publicDir,
        },
      },
    },
    hook: rs.fn(),
  };
}

function makeEngine() {
  return {
    env: {},
    buildProperties: {},
    upload_assets: rs.fn().mockResolvedValue(undefined),
    build_finished: rs.fn().mockResolvedValue(undefined),
  };
}

describe('resolveAssetSources', () => {
  it('uses only outputDir when publicDir is inside outputDir', () => {
    expect(
      resolveAssetSources('ssr', '/workspace/.output', '/workspace/.output/public')
    ).toEqual([{ dir: '/workspace/.output' }]);
  });

  it('adds external publicDir for ssr snapshots with public prefix', () => {
    expect(
      resolveAssetSources('ssr', '/workspace/.output', '/workspace/.public')
    ).toEqual([
      { dir: '/workspace/.output' },
      { dir: '/workspace/.public', prefix: 'public' },
    ]);
  });

  it('uses publicDir directly for csr snapshots', () => {
    expect(
      resolveAssetSources('csr', '/workspace/.output', '/workspace/.public')
    ).toEqual([{ dir: '/workspace/.public' }]);
  });
});

describe('createUploadRunner', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    mockedBuildAssetsMap.mockImplementation((assets: Record<string, Buffer>) => assets);
    mockedZeBuildDashData.mockResolvedValue({});
  });

  it('retries on subsequent calls after a failed upload attempt', async () => {
    const engine = makeEngine();
    const runner = createUploadRunner({
      nuxt: makeNuxt('/workspace/app'),
      options: { snapshotType: 'csr' },
      zephyrEngineDefer: Promise.resolve(engine as never),
      initEngine: rs.fn(),
    });

    mockedReadDirRecursiveWithContents
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce([
        {
          relativePath: 'index.html',
          content: Buffer.from('ok'),
        },
      ]);

    await runner();
    await runner();

    expect(mockedHandleGlobalError).toHaveBeenCalledTimes(1);
    expect(engine.upload_assets).toHaveBeenCalledTimes(1);
    expect(engine.build_finished).toHaveBeenCalledTimes(1);
  });

  it('uploads files from both outputDir and external publicDir for ssr', async () => {
    const rootDir = '/workspace/app';
    const outputDir = resolve(rootDir, '.output');
    const publicDir = resolve(rootDir, '.public');
    const engine = makeEngine();

    const runner = createUploadRunner({
      nuxt: makeNuxt(rootDir, '.public'),
      options: {
        snapshotType: 'ssr',
        entrypoint: 'server/index.mjs',
      },
      zephyrEngineDefer: Promise.resolve(engine as never),
      initEngine: rs.fn(),
    });

    mockedReadDirRecursiveWithContents.mockImplementation(async (dir: string) => {
      if (dir === outputDir) {
        return [
          {
            relativePath: 'server/index.mjs',
            content: Buffer.from('server'),
          },
        ];
      }
      if (dir === publicDir) {
        return [
          {
            relativePath: 'app.js',
            content: Buffer.from('public'),
          },
        ];
      }
      return [];
    });

    await runner();

    expect(mockedReadDirRecursiveWithContents).toHaveBeenCalledWith(outputDir);
    expect(mockedReadDirRecursiveWithContents).toHaveBeenCalledWith(publicDir);
    expect(engine.buildProperties.output).toBe(outputDir);

    const uploadCall = engine.upload_assets.mock.calls[0][0] as {
      assetsMap: Record<string, Buffer>;
    };
    expect(Object.keys(uploadCall.assetsMap).sort()).toEqual([
      'public/app.js',
      'server/index.mjs',
    ]);
  });
});
