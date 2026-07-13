import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { resolve } from 'node:path';
import {
  buildAssetsMap,
  handleGlobalError,
  readDirRecursiveWithContents,
  zeBuildDashData,
} from 'zephyr-agent';
import { createUploadRunner, resolveAssetSources } from './ssr-upload';
import type { NuxtLike } from './types';

rs.mock('zephyr-agent', () => ({
  buildAssetsMap: rs.fn(),
  handleGlobalError: rs.fn(),
  readDirRecursiveWithContents: rs.fn(),
  ZeErrors: { ERR_DEPLOY_LOCAL_BUILD: 'ERR_DEPLOY_LOCAL_BUILD' },
  ZephyrError: class extends Error {
    constructor(_: unknown, props?: { message?: string }) {
      super(props?.message);
    }
  },
  zeBuildDashData: rs.fn(),
  ze_log: {
    upload: rs.fn(),
  },
}));

const mockedBuildAssetsMap = buildAssetsMap as Mock;
const mockedHandleGlobalError = handleGlobalError as Mock;
const mockedReadDirRecursiveWithContents = readDirRecursiveWithContents as Mock;
const mockedZeBuildDashData = zeBuildDashData as Mock;

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
    build_id: undefined,
    start_new_build: rs.fn().mockResolvedValue(undefined),
    upload_assets: rs.fn().mockResolvedValue(undefined),
    build_finished: rs.fn().mockResolvedValue(undefined),
    build_failed: rs.fn(),
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

  it('keeps external publicDir paths unprefixed for locked tap-app artifacts', () => {
    expect(
      resolveAssetSources('ssr', '/workspace/.output', '/workspace/.public', 'tap-app')
    ).toEqual([{ dir: '/workspace/.output' }, { dir: '/workspace/.public' }]);
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
      zephyrEngineDefer: Promise.resolve(engine as any),
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
    expect(engine.build_failed).toHaveBeenCalledTimes(1);
    expect(engine.start_new_build).toHaveBeenCalledTimes(2);
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
      zephyrEngineDefer: Promise.resolve(engine as any),
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

    expect(mockedReadDirRecursiveWithContents).toHaveBeenCalledWith(outputDir, {
      includeIgnoredPaths: false,
      failOnError: false,
    });
    expect(mockedReadDirRecursiveWithContents).toHaveBeenCalledWith(publicDir, {
      includeIgnoredPaths: false,
      failOnError: false,
    });
    expect(engine.buildProperties.output).toBe(outputDir);

    const uploadCall = engine.upload_assets.mock.calls[0][0] as {
      assetsMap: Record<string, Buffer>;
    };
    expect(Object.keys(uploadCall.assetsMap).sort()).toEqual([
      'public/app.js',
      'server/index.mjs',
    ]);
  });

  it('preserves SDK-locked tap-app public paths and bytes', async () => {
    const rootDir = '/workspace/tap-package';
    const outputDir = resolve(rootDir, '.output');
    const publicDir = resolve(rootDir, '.public');
    const engine = makeEngine();
    const descriptor = Buffer.from('{"locked":true}');
    const remoteEntry = Buffer.from('export const target = "desktop";');

    const runner = createUploadRunner({
      nuxt: makeNuxt(rootDir, '.public'),
      options: {
        target: 'tap-app',
        snapshotType: 'ssr',
        entrypoint: 'server/index.mjs',
        mfConfigs: [{ name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' }],
        federation: [{ name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' }],
      },
      zephyrEngineDefer: Promise.resolve(engine as any),
      initEngine: rs.fn(),
    });

    mockedReadDirRecursiveWithContents.mockImplementation(async (dir: string) => {
      if (dir === outputDir) {
        return [{ relativePath: 'server/index.mjs', content: Buffer.from('server') }];
      }
      if (dir === publicDir) {
        return [
          { relativePath: 'manifest.tap.json', content: descriptor },
          { relativePath: 'targets/desktop/remoteEntry.mjs', content: remoteEntry },
        ];
      }
      return [];
    });

    await runner();

    const uploadCall = engine.upload_assets.mock.calls[0][0] as {
      assetsMap: Record<string, Buffer>;
    };
    expect(uploadCall.assetsMap).toEqual({
      'server/index.mjs': Buffer.from('server'),
      'manifest.tap.json': descriptor,
      'targets/desktop/remoteEntry.mjs': remoteEntry,
    });
    expect(uploadCall.assetsMap['manifest.tap.json']).toBe(descriptor);
    expect(uploadCall.assetsMap['targets/desktop/remoteEntry.mjs']).toBe(remoteEntry);
    expect(uploadCall.assetsMap['public/manifest.tap.json']).toBeUndefined();
    expect(mockedReadDirRecursiveWithContents).toHaveBeenCalledWith(outputDir, {
      includeIgnoredPaths: true,
      failOnError: true,
    });
    expect(mockedReadDirRecursiveWithContents).toHaveBeenCalledWith(publicDir, {
      includeIgnoredPaths: true,
      failOnError: true,
    });
  });

  it('forwards every aligned TAP Federation container without a legacy fallback', async () => {
    const rootDir = '/workspace/tap-package';
    const engine = makeEngine();
    const mfConfigs = [
      { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
      { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' },
    ];
    const federation = [
      { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
      { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs' },
    ];
    const runner = createUploadRunner({
      nuxt: makeNuxt(rootDir),
      options: {
        target: 'tap-app',
        snapshotType: 'csr',
        mfConfigs,
        federation,
      },
      zephyrEngineDefer: Promise.resolve(engine as any),
      initEngine: rs.fn(),
    });
    mockedReadDirRecursiveWithContents.mockResolvedValue([
      { relativePath: 'manifest.tap.json', content: Buffer.from('descriptor') },
    ]);
    mockedZeBuildDashData.mockResolvedValue({ stats: 'test' });

    await runner();

    const upload = engine.upload_assets.mock.calls[0]?.[0] as {
      mfConfig?: unknown;
      mfConfigs?: unknown;
      buildStats: { federation?: unknown };
    };
    expect(upload.mfConfigs).toBe(mfConfigs);
    expect(upload).not.toHaveProperty('mfConfig');
    expect(upload.buildStats.federation).toBe(federation);
  });

  it('derives legacy mfConfig only for one complete Federation config', async () => {
    const rootDir = '/workspace/app';
    const engine = makeEngine();
    const config = { name: 'desktop', filename: 'remoteEntry.mjs' };
    const runner = createUploadRunner({
      nuxt: makeNuxt(rootDir),
      options: { snapshotType: 'csr', mfConfigs: [config] },
      zephyrEngineDefer: Promise.resolve(engine as any),
      initEngine: rs.fn(),
    });
    mockedReadDirRecursiveWithContents.mockResolvedValue([
      { relativePath: 'index.html', content: Buffer.from('ok') },
    ]);

    await runner();

    const upload = engine.upload_assets.mock.calls[0]?.[0] as {
      mfConfig?: unknown;
      mfConfigs?: unknown;
    };
    expect(upload.mfConfigs).toEqual([config]);
    expect(upload.mfConfig).toBe(config);
  });

  it('fails closed when TAP metadata does not pair config filename with remote', async () => {
    const rootDir = '/workspace/tap-package';
    const engine = makeEngine();
    const runner = createUploadRunner({
      nuxt: makeNuxt(rootDir),
      options: {
        target: 'tap-app',
        snapshotType: 'csr',
        mfConfigs: [{ name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' }],
        federation: [{ name: 'desktop', remote: 'targets/quickjs/remoteEntry.mjs' }],
      },
      zephyrEngineDefer: Promise.resolve(engine as any),
      initEngine: rs.fn(),
    });
    mockedReadDirRecursiveWithContents.mockResolvedValue([
      { relativePath: 'manifest.tap.json', content: Buffer.from('descriptor') },
    ]);

    await runner();

    expect(engine.upload_assets).not.toHaveBeenCalled();
    expect(engine.build_failed).toHaveBeenCalledTimes(1);
    expect(mockedHandleGlobalError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('no matching') })
    );
  });

  it('fails closed for duplicate TAP Federation metadata identities', async () => {
    const rootDir = '/workspace/tap-package';
    const engine = makeEngine();
    const runner = createUploadRunner({
      nuxt: makeNuxt(rootDir),
      options: {
        target: 'tap-app',
        snapshotType: 'csr',
        mfConfigs: [
          { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
          { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' },
        ],
        federation: [
          { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
          { name: 'quickjs', remote: 'targets/desktop/remoteEntry.mjs' },
        ],
      },
      zephyrEngineDefer: Promise.resolve(engine as any),
      initEngine: rs.fn(),
    });
    mockedReadDirRecursiveWithContents.mockResolvedValue([
      { relativePath: 'manifest.tap.json', content: Buffer.from('descriptor') },
    ]);

    await runner();

    expect(engine.upload_assets).not.toHaveBeenCalled();
    expect(mockedHandleGlobalError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('duplicate names or remotes'),
      })
    );
  });

  it('fails closed when unprefixed tap-app sources collide', async () => {
    const rootDir = '/workspace/tap-package';
    const outputDir = resolve(rootDir, '.output');
    const publicDir = resolve(rootDir, '.public');
    const engine = makeEngine();
    const runner = createUploadRunner({
      nuxt: makeNuxt(rootDir, '.public'),
      options: {
        target: 'tap-app',
        snapshotType: 'ssr',
        entrypoint: 'server/index.mjs',
      },
      zephyrEngineDefer: Promise.resolve(engine as any),
      initEngine: rs.fn(),
    });

    mockedReadDirRecursiveWithContents.mockImplementation(async (dir: string) => {
      if (dir === outputDir) {
        return [
          { relativePath: 'server/index.mjs', content: Buffer.from('server') },
          { relativePath: 'manifest.tap.json', content: Buffer.from('first') },
        ];
      }
      if (dir === publicDir) {
        return [{ relativePath: 'manifest.tap.json', content: Buffer.from('second') }];
      }
      return [];
    });

    await runner();

    expect(mockedHandleGlobalError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('manifest.tap.json') })
    );
    expect(engine.upload_assets).not.toHaveBeenCalled();
    expect(engine.build_failed).toHaveBeenCalledTimes(1);
  });
});
