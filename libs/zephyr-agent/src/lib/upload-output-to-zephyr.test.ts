import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

import { ZeErrors, ZephyrError } from './errors';
import { uploadOutputToZephyr } from './upload-output-to-zephyr';
import { buildAssetsMapMock } from './transformers/ze-build-assets-map';
import { zeBuildDashData } from './transformers/ze-build-dash-data';
import { readDirRecursiveWithContents } from './utils/read-dir-recursive';
import { ZephyrEngine } from '../zephyr-engine';

rs.mock('./utils/read-dir-recursive', () => ({
  readDirRecursiveWithContents: rs.fn(),
}));

rs.mock('./transformers/ze-build-assets-map', () => ({
  buildAssetsMapMock: rs.fn(),
}));

rs.mock('./transformers/ze-build-dash-data', () => ({
  zeBuildDashData: rs.fn(),
}));

rs.mock('../zephyr-engine', () => ({
  ZephyrEngine: {
    create: rs.fn(),
  },
}));

function tapMetadata() {
  return {
    mfConfigs: [{ name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' }],
    federation: [{ name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' }],
  };
}

describe('uploadOutputToZephyr', () => {
  const mockReadDirRecursiveWithContents = readDirRecursiveWithContents as Mock<
    typeof readDirRecursiveWithContents
  >;
  const mockBuildAssetsMap = buildAssetsMapMock as Mock<typeof buildAssetsMapMock>;
  const mockZeBuildDashData = zeBuildDashData as Mock<typeof zeBuildDashData>;
  const mockZephyrEngineCreate = ZephyrEngine.create as Mock<typeof ZephyrEngine.create>;

  it('rejects an unsupported target before reading or publishing output', async () => {
    await expect(
      uploadOutputToZephyr({
        rootDir: '/tmp/project',
        outputDir: '/tmp/project/.output',
        target: 'desktop' as never,
      })
    ).rejects.toThrow('uploadOutputToZephyr({ target }) must be one of');

    expect(mockReadDirRecursiveWithContents).not.toHaveBeenCalled();
    expect(mockZephyrEngineCreate).not.toHaveBeenCalled();
  });

  it('rejects a TAP output without paired Federation metadata before reading files', async () => {
    await expect(
      uploadOutputToZephyr({
        rootDir: '/tmp/project',
        outputDir: '/tmp/project/.output',
        target: 'tap-app',
      })
    ).rejects.toThrow('requires non-empty mfConfigs and federation metadata');

    expect(mockReadDirRecursiveWithContents).not.toHaveBeenCalled();
    expect(mockZephyrEngineCreate).not.toHaveBeenCalled();
  });

  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('uploads output, maps public assets with baseURL, and returns deployment URL', async () => {
    const engine = {
      env: {
        target: 'web',
        ssr: false,
      },
      upload_assets: rs.fn().mockImplementation(async ({ hooks }) => {
        await hooks?.onDeployComplete?.({ url: 'https://example.zephyrcloud.app' });
      }),
      build_finished: rs.fn().mockResolvedValue(undefined),
    };

    mockZephyrEngineCreate.mockResolvedValue(
      engine as unknown as Awaited<ReturnType<typeof ZephyrEngine.create>>
    );
    mockZeBuildDashData.mockResolvedValue({ build: 'stats' } as unknown as Awaited<
      ReturnType<typeof zeBuildDashData>
    >);
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/tmp/project/.output/server/index.mjs',
        relativePath: 'server/index.mjs',
        content: Buffer.from('server'),
      },
      {
        fullPath: '/tmp/project/.output/client/docs/app.js',
        relativePath: 'client\\docs\\app.js',
        content: Buffer.from('client'),
      },
      {
        fullPath: '/tmp/project/.output/client/docs/app.js.map',
        relativePath: 'client\\docs\\app.js.map',
        content: Buffer.from('map'),
      },
    ]);

    mockBuildAssetsMap.mockImplementation((assets) => {
      const assetKeys = Object.keys(assets);
      expect(assetKeys).toEqual(
        expect.arrayContaining(['server/index.mjs', 'client/docs/app.js'])
      );
      expect(assetKeys).not.toContain('client/docs/app.js.map');
      return {
        hash1: {
          hash: 'hash1',
          path: 'server/index.mjs',
          buffer: Buffer.from('server'),
          size: 6,
        },
      } as unknown as ReturnType<typeof buildAssetsMapMock>;
    });

    const onDeployComplete = rs.fn();
    const result = await uploadOutputToZephyr({
      rootDir: '/tmp/project',
      outputDir: '/tmp/project/.output',
      publicDir: '/tmp/project/.output/client/docs',
      baseURL: '/docs/',
      hooks: {
        onDeployComplete,
      },
    });

    expect(mockZephyrEngineCreate).toHaveBeenCalledWith({
      builder: 'unknown',
      context: '/tmp/project',
      target: 'web',
    });
    expect(engine.env.target).toBe('web');
    expect(engine.env.ssr).toBe(true);
    expect(mockZeBuildDashData).toHaveBeenCalledWith(engine);
    expect(engine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotType: 'ssr',
        entrypoint: 'server/index.mjs',
      })
    );
    expect(onDeployComplete).toHaveBeenCalled();
    expect(result).toEqual({
      deploymentUrl: 'https://example.zephyrcloud.app',
      entrypoint: 'server/index.mjs',
    });
  });

  it('maps public assets by relative alias path when fullPath is outside publicDir', async () => {
    const engine = {
      env: {
        target: 'web',
        ssr: false,
      },
      upload_assets: rs.fn().mockResolvedValue(undefined),
      build_finished: rs.fn().mockResolvedValue(undefined),
    };

    mockZephyrEngineCreate.mockResolvedValue(
      engine as unknown as Awaited<ReturnType<typeof ZephyrEngine.create>>
    );
    mockZeBuildDashData.mockResolvedValue({ build: 'stats' } as unknown as Awaited<
      ReturnType<typeof zeBuildDashData>
    >);
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/tmp/project/.output/server/index.mjs',
        relativePath: 'server/index.mjs',
        content: Buffer.from('server'),
      },
      {
        fullPath: '/tmp/shared/symlinked.js',
        relativePath: 'client/docs/symlinked.js',
        content: Buffer.from('client'),
      },
    ]);

    mockBuildAssetsMap.mockImplementation((assets) => {
      const assetKeys = Object.keys(assets);
      expect(assetKeys).toEqual(
        expect.arrayContaining(['server/index.mjs', 'client/docs/symlinked.js'])
      );

      return {
        hash1: {
          hash: 'hash1',
          path: 'server/index.mjs',
          buffer: Buffer.from('server'),
          size: 6,
        },
      } as unknown as ReturnType<typeof buildAssetsMapMock>;
    });

    await uploadOutputToZephyr({
      rootDir: '/tmp/project',
      outputDir: '/tmp/project/.output',
      publicDir: '/tmp/project/.output/client/docs',
      baseURL: '/docs/',
    });
  });

  it('preserves package-relative TAP descriptor and target artifacts from a split publicDir', async () => {
    const engine = {
      env: {
        target: 'web',
        ssr: false,
      },
      upload_assets: rs.fn().mockResolvedValue(undefined),
      build_finished: rs.fn().mockResolvedValue(undefined),
    };
    const descriptor = Buffer.from('{"package":"tap-example"}');
    const remoteEntry = Buffer.from('export const target = "desktop";');
    const server = Buffer.from('server');
    let capturedAssets: Record<string, { content: Buffer }> | undefined;

    mockZephyrEngineCreate.mockResolvedValue(
      engine as unknown as Awaited<ReturnType<typeof ZephyrEngine.create>>
    );
    mockZeBuildDashData.mockResolvedValue({ build: 'stats' } as unknown as Awaited<
      ReturnType<typeof zeBuildDashData>
    >);
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/tmp/project/.output/server/index.mjs',
        relativePath: 'server/index.mjs',
        content: server,
      },
      {
        fullPath: '/tmp/project/.output/tap-package/manifest.tap.json',
        relativePath: 'tap-package/manifest.tap.json',
        content: descriptor,
      },
      {
        fullPath: '/tmp/project/.output/tap-package/targets/desktop/remoteEntry.mjs',
        relativePath: 'tap-package/targets/desktop/remoteEntry.mjs',
        content: remoteEntry,
      },
    ]);
    mockBuildAssetsMap.mockImplementation((assets) => {
      capturedAssets = assets as Record<string, { content: Buffer }>;
      return {
        hash1: {
          hash: 'hash1',
          path: 'server/index.mjs',
          buffer: server,
          size: server.length,
        },
      } as unknown as ReturnType<typeof buildAssetsMapMock>;
    });

    await uploadOutputToZephyr({
      rootDir: '/tmp/project',
      outputDir: '/tmp/project/.output',
      publicDir: '/tmp/project/.output/tap-package',
      baseURL: '/docs/',
      target: 'tap-app',
      ssr: true,
      ...tapMetadata(),
    });

    expect(mockZephyrEngineCreate).toHaveBeenCalledWith({
      builder: 'unknown',
      context: '/tmp/project',
      target: 'tap-app',
    });
    expect(Object.keys(capturedAssets ?? {}).sort()).toEqual([
      'server/index.mjs',
      'tap-package/manifest.tap.json',
      'tap-package/targets/desktop/remoteEntry.mjs',
    ]);
    expect(capturedAssets?.['tap-package/manifest.tap.json']?.content).toBe(descriptor);
    expect(capturedAssets?.['tap-package/targets/desktop/remoteEntry.mjs']?.content).toBe(
      remoteEntry
    );
    expect(capturedAssets).not.toHaveProperty('client/docs/manifest.tap.json');
    expect(engine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotType: 'ssr',
        entrypoint: 'server/index.mjs',
      })
    );
  });

  it('defaults a standard TAP artifact set to CSR without requiring a server entrypoint', async () => {
    const engine = {
      env: { target: 'web', ssr: true },
      upload_assets: rs.fn().mockResolvedValue(undefined),
      build_finished: rs.fn().mockResolvedValue(undefined),
    };
    const descriptor = Buffer.from('{"package":"tap-example"}');
    const remoteEntry = Buffer.from('export const target = "desktop";');

    mockZephyrEngineCreate.mockResolvedValue(
      engine as unknown as Awaited<ReturnType<typeof ZephyrEngine.create>>
    );
    mockZeBuildDashData.mockResolvedValue({ build: 'stats' } as never);
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/tmp/project/dist/manifest.tap.json',
        relativePath: 'manifest.tap.json',
        content: descriptor,
      },
      {
        fullPath: '/tmp/project/dist/targets/desktop/remoteEntry.mjs',
        relativePath: 'targets/desktop/remoteEntry.mjs',
        content: remoteEntry,
      },
    ]);
    mockBuildAssetsMap.mockReturnValue({
      descriptor: {
        hash: 'descriptor',
        path: 'manifest.tap.json',
        buffer: descriptor,
        size: descriptor.length,
      },
      remoteEntry: {
        hash: 'remote-entry',
        path: 'targets/desktop/remoteEntry.mjs',
        buffer: remoteEntry,
        size: remoteEntry.length,
      },
    } as never);

    await expect(
      uploadOutputToZephyr({
        rootDir: '/tmp/project',
        outputDir: '/tmp/project/dist',
        target: 'tap-app',
        ...tapMetadata(),
      })
    ).resolves.toEqual({ deploymentUrl: null, entrypoint: undefined });

    expect(engine.env.ssr).toBe(false);
    expect(engine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({ snapshotType: 'csr', entrypoint: undefined })
    );
  });

  it('retains every SDK-locked TAP file that generic web deployment filters omit', async () => {
    const engine = {
      env: { target: 'web', ssr: false },
      upload_assets: rs.fn().mockResolvedValue(undefined),
      build_finished: rs.fn().mockResolvedValue(undefined),
    };
    let capturedAssets: Record<string, { content: Buffer }> | undefined;
    mockZephyrEngineCreate.mockResolvedValue(
      engine as unknown as Awaited<ReturnType<typeof ZephyrEngine.create>>
    );
    mockZeBuildDashData.mockResolvedValue({ build: 'stats' } as never);
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/tmp/project/dist/manifest.tap.json',
        relativePath: 'manifest.tap.json',
        content: Buffer.from('descriptor'),
      },
      {
        fullPath: '/tmp/project/dist/targets/desktop/remoteEntry.mjs.map',
        relativePath: 'targets/desktop/remoteEntry.mjs.map',
        content: Buffer.from('map'),
      },
      {
        fullPath: '/tmp/project/dist/node_modules/locked/asset.bin',
        relativePath: 'node_modules/locked/asset.bin',
        content: Buffer.from([0, 255, 1]),
      },
      {
        fullPath: '/tmp/project/dist/.git/locked-metadata',
        relativePath: '.git/locked-metadata',
        content: Buffer.from('opaque'),
      },
    ]);
    mockBuildAssetsMap.mockImplementation((assets) => {
      capturedAssets = assets as Record<string, { content: Buffer }>;
      return {
        hash: {
          hash: 'hash',
          path: 'manifest.tap.json',
          buffer: Buffer.from('descriptor'),
          size: 10,
        },
      } as unknown as ReturnType<typeof buildAssetsMapMock>;
    });

    await uploadOutputToZephyr({
      rootDir: '/tmp/project',
      outputDir: '/tmp/project/dist',
      target: 'tap-app',
      ssr: false,
      ...tapMetadata(),
    });

    expect(Object.keys(capturedAssets ?? {}).sort()).toEqual([
      '.git/locked-metadata',
      'manifest.tap.json',
      'node_modules/locked/asset.bin',
      'targets/desktop/remoteEntry.mjs.map',
    ]);
  });

  it('carries every TAP Federation container without selecting a legacy first entry', async () => {
    const engine = {
      env: { target: 'web', ssr: false },
      upload_assets: rs.fn().mockResolvedValue(undefined),
      build_finished: rs.fn().mockResolvedValue(undefined),
    };
    mockZephyrEngineCreate.mockResolvedValue(
      engine as unknown as Awaited<ReturnType<typeof ZephyrEngine.create>>
    );
    mockZeBuildDashData.mockResolvedValue({ build: 'stats' } as never);
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/tmp/project/dist/manifest.tap.json',
        relativePath: 'manifest.tap.json',
        content: Buffer.from('descriptor'),
      },
    ]);
    mockBuildAssetsMap.mockReturnValue({
      hash: {
        hash: 'hash',
        path: 'manifest.tap.json',
        buffer: Buffer.from('descriptor'),
        size: 10,
      },
    } as never);
    const mfConfigs = [
      { name: 'desktop', filename: 'targets/desktop/remoteEntry.mjs' },
      { name: 'quickjs', filename: 'targets/quickjs/remoteEntry.mjs' },
    ];
    const federation = [
      { name: 'desktop', remote: 'targets/desktop/remoteEntry.mjs' },
      { name: 'quickjs', remote: 'targets/quickjs/remoteEntry.mjs' },
    ];

    await uploadOutputToZephyr({
      rootDir: '/tmp/project',
      outputDir: '/tmp/project/dist',
      target: 'tap-app',
      ssr: false,
      mfConfigs,
      federation,
    });

    const upload = engine.upload_assets.mock.calls[0]?.[0] as {
      mfConfig?: unknown;
      mfConfigs?: unknown;
      buildStats: { federation?: unknown };
    };
    expect(upload.mfConfigs).toBe(mfConfigs);
    expect(upload).not.toHaveProperty('mfConfig');
    expect(upload.buildStats.federation).toBe(federation);
  });

  it('fails closed when normalized TAP package artifact paths collide', async () => {
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/tmp/project/.output/tap-package/manifest.tap.json',
        relativePath: 'tap-package/manifest.tap.json',
        content: Buffer.from('first descriptor'),
      },
      {
        fullPath: '/tmp/project/.output/tap-package/manifest-alias.tap.json',
        relativePath: 'tap-package\\manifest.tap.json',
        content: Buffer.from('second descriptor'),
      },
    ]);

    await expect(
      uploadOutputToZephyr({
        rootDir: '/tmp/project',
        outputDir: '/tmp/project/.output',
        publicDir: '/tmp/project/.output/tap-package',
        target: 'tap-app',
        ...tapMetadata(),
      })
    ).rejects.toMatchObject({
      code: ZephyrError.toZeCode(ZeErrors.ERR_DEPLOY_LOCAL_BUILD),
      message: expect.stringContaining('tap-package/manifest.tap.json'),
    });

    expect(mockBuildAssetsMap).not.toHaveBeenCalled();
    expect(mockZephyrEngineCreate).not.toHaveBeenCalled();
  });

  it('throws ERR_ASSETS_NOT_FOUND when no deployable assets exist', async () => {
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/tmp/project/.output/client/docs/app.js.map',
        relativePath: 'client/docs/app.js.map',
        content: Buffer.from('map'),
      },
    ]);

    await expect(
      uploadOutputToZephyr({
        rootDir: '/tmp/project',
        outputDir: '/tmp/project/.output',
      })
    ).rejects.toMatchObject({
      code: ZephyrError.toZeCode(ZeErrors.ERR_ASSETS_NOT_FOUND),
    });
  });

  it('throws when SSR entrypoint cannot be detected', async () => {
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/tmp/project/.output/client/main.js',
        relativePath: 'client/main.js',
        content: Buffer.from('client'),
      },
    ]);

    mockBuildAssetsMap.mockReturnValue({
      hash1: {
        hash: 'hash1',
        path: 'client/main.js',
        buffer: Buffer.from('client'),
        size: 6,
      },
    } as unknown as ReturnType<typeof buildAssetsMapMock>);

    await expect(
      uploadOutputToZephyr({
        rootDir: '/tmp/project',
        outputDir: '/tmp/project/.output',
      })
    ).rejects.toMatchObject({
      code: ZephyrError.toZeCode(ZeErrors.ERR_SSR_ENTRYPOINT_NOT_FOUND),
    });
  });

  it('supports non-SSR uploads without requiring entrypoint', async () => {
    const engine = {
      env: {
        target: 'web',
        ssr: false,
      },
      upload_assets: rs.fn().mockResolvedValue(undefined),
      build_finished: rs.fn().mockResolvedValue(undefined),
    };

    mockZephyrEngineCreate.mockResolvedValue(
      engine as unknown as Awaited<ReturnType<typeof ZephyrEngine.create>>
    );
    mockZeBuildDashData.mockResolvedValue({ build: 'stats' } as unknown as Awaited<
      ReturnType<typeof zeBuildDashData>
    >);
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/tmp/project/.output/client/main.js',
        relativePath: 'client/main.js',
        content: Buffer.from('client'),
      },
    ]);
    mockBuildAssetsMap.mockReturnValue({
      hash1: {
        hash: 'hash1',
        path: 'client/main.js',
        buffer: Buffer.from('client'),
        size: 6,
      },
    } as unknown as ReturnType<typeof buildAssetsMapMock>);

    const result = await uploadOutputToZephyr({
      rootDir: '/tmp/project',
      outputDir: '/tmp/project/.output',
      ssr: false,
      target: 'android',
    });

    expect(engine.env.target).toBe('android');
    expect(engine.env.ssr).toBe(false);
    expect(engine.upload_assets).toHaveBeenCalledWith(
      expect.objectContaining({
        snapshotType: 'csr',
        entrypoint: undefined,
      })
    );
    expect(result).toEqual({
      deploymentUrl: null,
      entrypoint: undefined,
    });
  });

  it('rolls back the created generation when build stats fail before upload', async () => {
    const buildStatsFailure = new Error('stats failed');
    const engine = {
      env: { target: 'web', ssr: false },
      build_id: Promise.resolve('build-id'),
      upload_assets: rs.fn(),
      build_finished: rs.fn(),
      build_failed: rs.fn(),
    };
    mockZephyrEngineCreate.mockResolvedValue(
      engine as unknown as Awaited<ReturnType<typeof ZephyrEngine.create>>
    );
    mockReadDirRecursiveWithContents.mockResolvedValue([
      {
        fullPath: '/tmp/project/.output/client/main.js',
        relativePath: 'client/main.js',
        content: Buffer.from('client'),
      },
    ]);
    mockBuildAssetsMap.mockReturnValue({
      hash1: {
        hash: 'hash1',
        path: 'client/main.js',
        buffer: Buffer.from('client'),
        size: 6,
      },
    } as unknown as ReturnType<typeof buildAssetsMapMock>);
    mockZeBuildDashData.mockRejectedValue(buildStatsFailure);

    await expect(
      uploadOutputToZephyr({
        rootDir: '/tmp/project',
        outputDir: '/tmp/project/.output',
        ssr: false,
      })
    ).rejects.toBe(buildStatsFailure);

    expect(engine.build_failed).toHaveBeenCalledTimes(1);
    expect(engine.upload_assets).not.toHaveBeenCalled();
  });
});
