import { ZeErrors, ZephyrError } from './errors';
import { uploadOutputToZephyr } from './upload-output-to-zephyr';
import { buildAssetsMapMock } from './transformers/ze-build-assets-map';
import { zeBuildDashData } from './transformers/ze-build-dash-data';
import { readDirRecursiveWithContents } from './utils/read-dir-recursive';
import { ZephyrEngine } from '../zephyr-engine';

jest.mock('./utils/read-dir-recursive', () => ({
  readDirRecursiveWithContents: jest.fn(),
}));

jest.mock('./transformers/ze-build-assets-map', () => ({
  buildAssetsMapMock: jest.fn(),
}));

jest.mock('./transformers/ze-build-dash-data', () => ({
  zeBuildDashData: jest.fn(),
}));

jest.mock('../zephyr-engine', () => ({
  ZephyrEngine: {
    create: jest.fn(),
  },
}));

describe('uploadOutputToZephyr', () => {
  const mockReadDirRecursiveWithContents =
    readDirRecursiveWithContents as jest.MockedFunction<
      typeof readDirRecursiveWithContents
    >;
  const mockBuildAssetsMap = buildAssetsMapMock as jest.MockedFunction<
    typeof buildAssetsMapMock
  >;
  const mockZeBuildDashData = zeBuildDashData as jest.MockedFunction<
    typeof zeBuildDashData
  >;
  const mockZephyrEngineCreate = ZephyrEngine.create as jest.MockedFunction<
    typeof ZephyrEngine.create
  >;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uploads output, maps public assets with baseURL, and returns deployment URL', async () => {
    const engine = {
      env: {
        target: 'web',
        ssr: false,
      },
      upload_assets: jest.fn().mockImplementation(async ({ hooks }) => {
        await hooks?.onDeployComplete?.({ url: 'https://example.zephyrcloud.app' });
      }),
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

    const onDeployComplete = jest.fn();
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
      upload_assets: jest.fn().mockResolvedValue(undefined),
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
      upload_assets: jest.fn().mockResolvedValue(undefined),
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
});
