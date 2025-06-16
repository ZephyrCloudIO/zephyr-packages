import type { OutputAsset, OutputChunk } from 'rollup';
import {
  buildAssetsMap,
  getPartialAssetMap,
  removePartialAssetMap,
  type ZeBuildAssetsMap,
  type ZephyrEngine,
} from 'zephyr-agent';
import { getRollxAssetType } from 'zephyr-rollx-internal';
import type { ZephyrInternalOptions } from '../../types/zephyr-internal-options';
import { extract_vite_assets_map } from '../extract_vite_assets_map';
import { loadStaticAssets } from '../load_static_assets';

// Local implementation for testing
const extractRollxBuffer = (asset: any): string | Buffer | undefined => {
  switch (asset.type) {
    case 'chunk':
      return asset.code;
    case 'asset':
      if (typeof asset.source === 'string') {
        return asset.source;
      }
      return Buffer.from(asset.source);
    default:
      return undefined;
  }
};

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

const binaryData = new TextEncoder().encode('binary content');

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
        // partial assets are spread using Object.values, which spreads their properties
        type: 'chunk',
        code: 'console.log("partial");',
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
});

describe('getAssetType', () => {
  it('should return correct asset type for chunk', () => {
    const chunkAsset: OutputChunk = { type: 'chunk' } as OutputChunk;

    expect(getRollxAssetType(chunkAsset)).toBe('chunk');
  });

  it('should return correct asset type for asset', () => {
    const outputAsset: OutputAsset = { type: 'asset' } as OutputAsset;

    expect(getRollxAssetType(outputAsset)).toBe('asset');
  });
});

describe('extractBuffer', () => {
  it('should extract code from chunk assets', () => {
    const chunkAsset: OutputChunk = {
      type: 'chunk',
      code: 'console.log("test");',
    } as OutputChunk;

    expect(extractRollxBuffer(chunkAsset)).toBe('console.log("test");');
  });

  it('should extract string source from asset', () => {
    const assetWithStringSource: OutputAsset = {
      type: 'asset',
      source: 'body { color: red; }',
    } as OutputAsset;

    expect(extractRollxBuffer(assetWithStringSource)).toBe('body { color: red; }');
  });

  it('should convert buffer source to Buffer for binary assets', () => {
    const assetWithBufferSource: OutputAsset = {
      type: 'asset',
      source: binaryData,
    } as OutputAsset;

    const result = extractRollxBuffer(assetWithBufferSource);
    expect(result).toBeInstanceOf(Buffer);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result).toEqual(Buffer.from(binaryData));
  });

  it('should return undefined for unknown asset types', () => {
    const unknownAsset = { asset: { type: 'unknown', source: 'unknown' } };

    expect(extractRollxBuffer(unknownAsset as any)).toBeUndefined();
  });
});
