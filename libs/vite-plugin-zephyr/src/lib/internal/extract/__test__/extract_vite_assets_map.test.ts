import type { OutputAsset, OutputChunk } from 'rollup';
import {
  buildAssetsMap,
  getPartialAssetMap,
  removePartialAssetMap,
  type ZeBuildAssetsMap,
  type ZephyrEngine,
} from 'zephyr-agent';
import type { ZephyrInternalOptions } from '../../types/zephyr-internal-options';
import { extract_vite_assets_map } from '../extract_vite_assets_map';
import { loadStaticAssets } from '../load_static_assets';

jest.mock('zephyr-agent', () => ({
  buildAssetsMap: jest.fn(),
  getPartialAssetMap: jest.fn(),
  removePartialAssetMap: jest.fn(),
}));

jest.mock('../load_static_assets', () => ({
  loadStaticAssets: jest.fn(),
}));

const mockBuildAssetsMap = buildAssetsMap as jest.MockedFunction<typeof buildAssetsMap>;
const mockGetPartialAssetMap = getPartialAssetMap as jest.MockedFunction<
  typeof getPartialAssetMap
>;
const mockRemovePartialAssetMap = removePartialAssetMap as jest.MockedFunction<
  typeof removePartialAssetMap
>;
const mockLoadStaticAssets = loadStaticAssets as jest.MockedFunction<
  typeof loadStaticAssets
>;

// Mock data shared across all tests
const mockZephyrEngine: ZephyrEngine = {
  application_uid: 'test-app-uid',
} as ZephyrEngine;

const mockViteInternalOptions: ZephyrInternalOptions = {
  root: '/test/root',
  outDir: '/test/out',
  assets: {
    'runtime-asset.js': {
      type: 'chunk',
      code: 'console.log("runtime");',
    } as OutputChunk,
  },
};

const PNG_HEADER_BYTES = [137, 80, 78, 71]; // PNG file signature magic bytes
const binaryData = new Uint8Array(PNG_HEADER_BYTES);

describe('extract_vite_assets_map', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should extract vite assets map successfully', async () => {
    const mockStaticAssets = {
      'static-asset.css': {
        type: 'asset',
        source: 'body { color: red; }',
      } as OutputAsset,
    };

    const mockPartialAssetMap = {
      'partial-asset.js': {
        type: 'chunk',
        code: 'console.log("partial");',
      } as unknown as ZeBuildAssetsMap[string],
    };

    const mockBuildResult = { assets: 'mock-build-result' };

    mockLoadStaticAssets.mockResolvedValue(mockStaticAssets);
    mockGetPartialAssetMap.mockResolvedValue(mockPartialAssetMap);
    mockRemovePartialAssetMap.mockResolvedValue();
    mockBuildAssetsMap.mockReturnValue(mockBuildResult as any);

    const result = await extract_vite_assets_map(
      mockZephyrEngine,
      mockViteInternalOptions
    );

    expect(mockLoadStaticAssets).toHaveBeenCalledWith(mockViteInternalOptions);
    expect(mockGetPartialAssetMap).toHaveBeenCalledWith('test-app-uid');
    expect(mockRemovePartialAssetMap).toHaveBeenCalledWith('test-app-uid');
    expect(mockBuildAssetsMap).toHaveBeenCalledWith(
      expect.objectContaining({
        'static-asset.css': mockStaticAssets['static-asset.css'],
        'runtime-asset.js': mockViteInternalOptions.assets!['runtime-asset.js'],
      }),
      expect.any(Function), // extractBuffer
      expect.any(Function) // getAssetType
    );
    expect(result).toBe(mockBuildResult);
  });

  it('should handle null partial asset map', async () => {
    const mockStaticAssets = {};
    const mockBuildResult = { assets: 'mock-build-result' };

    mockLoadStaticAssets.mockResolvedValue(mockStaticAssets);
    mockGetPartialAssetMap.mockResolvedValue(undefined);
    mockRemovePartialAssetMap.mockResolvedValue();
    mockBuildAssetsMap.mockReturnValue(mockBuildResult as any);

    const result = await extract_vite_assets_map(
      mockZephyrEngine,
      mockViteInternalOptions
    );

    expect(mockBuildAssetsMap).toHaveBeenCalledWith(
      expect.objectContaining({
        'runtime-asset.js': mockViteInternalOptions.assets!['runtime-asset.js'],
      }),
      expect.any(Function),
      expect.any(Function)
    );
    expect(result).toBe(mockBuildResult);
  });

  it('should skip vite inspect artifacts from upload map', async () => {
    const mockStaticAssets = {
      '.vite-inspect/index.html': {
        type: 'asset',
        source: '<html></html>',
      } as OutputAsset,
      'assets/app.js': {
        type: 'chunk',
        code: 'console.log("app");',
      } as OutputChunk,
    };
    const mockBuildResult = { assets: 'mock-build-result' };

    mockLoadStaticAssets.mockResolvedValue(mockStaticAssets);
    mockGetPartialAssetMap.mockResolvedValue(undefined);
    mockRemovePartialAssetMap.mockResolvedValue();
    mockBuildAssetsMap.mockReturnValue(mockBuildResult as any);

    await extract_vite_assets_map(mockZephyrEngine, mockViteInternalOptions);

    const submittedAssets = mockBuildAssetsMap.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(submittedAssets).toEqual(
      expect.objectContaining({
        'assets/app.js': mockStaticAssets['assets/app.js'],
      })
    );
    expect(submittedAssets['.vite-inspect/index.html']).toBeUndefined();
  });
});

describe('getAssetType', () => {
  // We need to test the function passed to buildAssetsMap, but it's not exported
  // So we'll test it indirectly through the main function
  it('should return correct asset type for chunk', async () => {
    const mockAssets = {};
    const mockBuildResult = { assets: 'mock-build-result' };

    mockLoadStaticAssets.mockResolvedValue(mockAssets);
    mockGetPartialAssetMap.mockResolvedValue(undefined);
    mockRemovePartialAssetMap.mockResolvedValue();
    mockBuildAssetsMap.mockReturnValue(mockBuildResult as any);

    await extract_vite_assets_map(mockZephyrEngine, mockViteInternalOptions);

    const getAssetTypeFn = mockBuildAssetsMap.mock.calls[0][2];
    const chunkAsset: OutputChunk = { type: 'chunk' } as OutputChunk;

    expect(getAssetTypeFn(chunkAsset)).toBe('chunk');
  });

  it('should return correct asset type for asset', async () => {
    const mockAssets = {};
    const mockBuildResult = { assets: 'mock-build-result' };

    mockLoadStaticAssets.mockResolvedValue(mockAssets);
    mockGetPartialAssetMap.mockResolvedValue(undefined);
    mockRemovePartialAssetMap.mockResolvedValue();
    mockBuildAssetsMap.mockReturnValue(mockBuildResult as any);

    await extract_vite_assets_map(mockZephyrEngine, mockViteInternalOptions);

    const getAssetTypeFn = mockBuildAssetsMap.mock.calls[0][2];
    const outputAsset: OutputAsset = { type: 'asset' } as OutputAsset;

    expect(getAssetTypeFn(outputAsset)).toBe('asset');
  });
});

describe('extractBuffer', () => {
  it('should extract code from chunk assets', async () => {
    const mockAssets = {};
    const mockBuildResult = { assets: 'mock-build-result' };

    mockLoadStaticAssets.mockResolvedValue(mockAssets);
    mockGetPartialAssetMap.mockResolvedValue(undefined);
    mockRemovePartialAssetMap.mockResolvedValue();
    mockBuildAssetsMap.mockReturnValue(mockBuildResult as any);

    await extract_vite_assets_map(mockZephyrEngine, mockViteInternalOptions);

    const extractBufferFn = mockBuildAssetsMap.mock.calls[0][1];
    const chunkAsset: OutputChunk = {
      type: 'chunk',
      code: 'console.log("test");',
    } as OutputChunk;

    expect(extractBufferFn(chunkAsset)).toBe('console.log("test");');
  });

  it('should extract string source from asset', async () => {
    const mockAssets = {};
    const mockBuildResult = { assets: 'mock-build-result' };

    mockLoadStaticAssets.mockResolvedValue(mockAssets);
    mockGetPartialAssetMap.mockResolvedValue(undefined);
    mockRemovePartialAssetMap.mockResolvedValue();
    mockBuildAssetsMap.mockReturnValue(mockBuildResult as any);

    await extract_vite_assets_map(mockZephyrEngine, mockViteInternalOptions);

    const extractBufferFn = mockBuildAssetsMap.mock.calls[0][1];
    const assetWithStringSource: OutputAsset = {
      type: 'asset',
      source: 'body { color: red; }',
    } as OutputAsset;

    expect(extractBufferFn(assetWithStringSource)).toBe('body { color: red; }');
  });

  it('should convert buffer source to Buffer for binary assets', async () => {
    const mockAssets = {};
    const mockBuildResult = { assets: 'mock-build-result' };

    mockLoadStaticAssets.mockResolvedValue(mockAssets);
    mockGetPartialAssetMap.mockResolvedValue(undefined);
    mockRemovePartialAssetMap.mockResolvedValue();
    mockBuildAssetsMap.mockReturnValue(mockBuildResult as any);

    await extract_vite_assets_map(mockZephyrEngine, mockViteInternalOptions);

    const extractBufferFn = mockBuildAssetsMap.mock.calls[0][1];
    const assetWithBufferSource: OutputAsset = {
      type: 'asset',
      source: binaryData,
    } as OutputAsset;

    const result = extractBufferFn(assetWithBufferSource);
    expect(result).toBeInstanceOf(Buffer);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(Buffer.from(binaryData));
  });

  it('should return undefined for unknown asset types', async () => {
    const mockAssets = {};
    const mockBuildResult = { assets: 'mock-build-result' };

    mockLoadStaticAssets.mockResolvedValue(mockAssets);
    mockGetPartialAssetMap.mockResolvedValue(undefined);
    mockRemovePartialAssetMap.mockResolvedValue();
    mockBuildAssetsMap.mockReturnValue(mockBuildResult as any);

    await extract_vite_assets_map(mockZephyrEngine, mockViteInternalOptions);

    const extractBufferFn = mockBuildAssetsMap.mock.calls[0][1];
    const unknownAsset = { type: 'unknown' };

    expect(extractBufferFn(unknownAsset)).toBeUndefined();
  });
});
