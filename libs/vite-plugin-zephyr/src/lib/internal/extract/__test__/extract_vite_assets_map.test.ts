import { beforeEach, describe, expect, it, rs } from '@rstest/core';
import type { Mock } from '@rstest/core';

import type { OutputAsset, OutputChunk } from 'rollup';
import { buildAssetsMap, type ZephyrEngine } from 'zephyr-agent';
import type { ZephyrInternalOptions } from '../../types/zephyr-internal-options';
import { extract_vite_assets_map } from '../extract_vite_assets_map';
import { loadStaticAssets } from '../load_static_assets';

rs.mock('zephyr-agent', () => {
  class MockZephyrError extends Error {
    constructor(_code: string, options?: { message?: string }) {
      super(options?.message ?? _code);
    }
  }

  return {
    buildAssetsMap: rs.fn(),
    ZeErrors: { ERR_DEPLOY_LOCAL_BUILD: 'ERR_DEPLOY_LOCAL_BUILD' },
    ZephyrError: MockZephyrError,
  };
});

rs.mock('../load_static_assets', () => ({
  loadStaticAssets: rs.fn(),
}));

const mockBuildAssetsMap = buildAssetsMap as Mock<typeof buildAssetsMap>;
const mockLoadStaticAssets = loadStaticAssets as Mock<typeof loadStaticAssets>;

// Mock data shared across all tests
const mockZephyrEngine: ZephyrEngine = {
  application_uid: 'test-app-uid',
} as ZephyrEngine;

const runtimeAsset = {
  type: 'chunk',
  code: 'console.log("runtime");',
} as OutputChunk;
const mockViteInternalOptions: ZephyrInternalOptions = {
  root: '/test/root',
  outDir: '/test/out',
  assets: { 'runtime-asset.js': runtimeAsset },
};

const PNG_HEADER_BYTES = [137, 80, 78, 71]; // PNG file signature magic bytes
const binaryData = new Uint8Array(PNG_HEADER_BYTES);

describe('extract_vite_assets_map', () => {
  beforeEach(() => {
    rs.clearAllMocks();
  });

  it('should extract vite assets map successfully', async () => {
    const mockStaticAssets = {
      'static-asset.css': {
        type: 'asset',
        source: 'body { color: red; }',
      } as OutputAsset,
    };

    const mockBuildResult: ReturnType<typeof buildAssetsMap> = {};

    mockLoadStaticAssets.mockResolvedValue(mockStaticAssets);
    mockBuildAssetsMap.mockReturnValue(mockBuildResult);

    const result = await extract_vite_assets_map(
      mockZephyrEngine,
      mockViteInternalOptions
    );

    expect(mockLoadStaticAssets).toHaveBeenCalledWith(mockViteInternalOptions);
    expect(mockBuildAssetsMap).toHaveBeenCalledWith(
      expect.objectContaining({
        'static-asset.css': mockStaticAssets['static-asset.css'],
        'runtime-asset.js': runtimeAsset,
      }),
      expect.any(Function), // extractBuffer
      expect.any(Function) // getAssetType
    );
    expect(result).toEqual(mockBuildResult);
  });

  it('should handle null partial asset map', async () => {
    const mockStaticAssets = {};
    const mockBuildResult: ReturnType<typeof buildAssetsMap> = {};

    mockLoadStaticAssets.mockResolvedValue(mockStaticAssets);
    mockBuildAssetsMap.mockReturnValue(mockBuildResult);

    const result = await extract_vite_assets_map(
      mockZephyrEngine,
      mockViteInternalOptions
    );

    expect(mockBuildAssetsMap).toHaveBeenCalledWith(
      expect.objectContaining({
        'runtime-asset.js': runtimeAsset,
      }),
      expect.any(Function),
      expect.any(Function)
    );
    expect(result).toEqual(mockBuildResult);
  });

  it('rejects runtime bytes that conflict with a static asset at the same path', async () => {
    const staticBytes = Uint8Array.from([0x01, 0x02, 0x03]);
    const runtimeBytes = Uint8Array.from([0x01, 0x02, 0x04]);
    mockLoadStaticAssets.mockResolvedValue({
      'manifest.tap.lock': {
        type: 'asset',
        source: staticBytes,
      } as OutputAsset,
    });

    await expect(
      extract_vite_assets_map(mockZephyrEngine, {
        ...mockViteInternalOptions,
        target: 'tap-app',
        assets: {
          'manifest.tap.lock': {
            type: 'asset',
            source: runtimeBytes,
          } as OutputAsset,
        },
      })
    ).rejects.toThrow('Vite emitted conflicting assets for "manifest.tap.lock".');
    expect(mockBuildAssetsMap).not.toHaveBeenCalled();
  });

  it('allows byte-identical runtime and static assets at the same path', async () => {
    const bytes = Uint8Array.from([0xff, 0x00, 0x80]);
    const staticAsset = {
      type: 'asset',
      source: bytes,
    } as OutputAsset;
    mockLoadStaticAssets.mockResolvedValue({
      'manifest.tap.lock': staticAsset,
    });
    mockBuildAssetsMap.mockReturnValue({});

    await extract_vite_assets_map(mockZephyrEngine, {
      ...mockViteInternalOptions,
      target: 'tap-app',
      assets: {
        'manifest.tap.lock': {
          type: 'asset',
          source: Uint8Array.from(bytes),
        } as OutputAsset,
      },
    });

    const submittedAssets = mockBuildAssetsMap.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(submittedAssets).toEqual({ 'manifest.tap.lock': staticAsset });
  });

  it('prefers emitted runtime output over an on-disk copy for conventional Vite builds', async () => {
    const staticAsset = {
      type: 'asset' as const,
      source: 'written before finalization',
    } as OutputAsset;
    const runtimeAsset = {
      type: 'chunk' as const,
      code: 'final emitted runtime',
    } as OutputChunk;
    mockLoadStaticAssets.mockResolvedValue({ 'remoteEntry.js': staticAsset });
    mockBuildAssetsMap.mockReturnValue({});

    await extract_vite_assets_map(mockZephyrEngine, {
      ...mockViteInternalOptions,
      assets: { 'remoteEntry.js': runtimeAsset },
    });

    const submittedAssets = mockBuildAssetsMap.mock.calls[0]?.[0] as Record<
      string,
      unknown
    >;
    expect(submittedAssets).toEqual({ 'remoteEntry.js': runtimeAsset });
  });

  it('rejects byte-identical TAP bundle aliases before normalizing their path', async () => {
    const bytes = Uint8Array.from([0xff, 0x00, 0x80]);
    mockLoadStaticAssets.mockResolvedValue({});

    await expect(
      extract_vite_assets_map(mockZephyrEngine, {
        ...mockViteInternalOptions,
        target: 'tap-app',
        assets: {
          'tap/asset-lock.json': {
            type: 'asset',
            source: bytes,
          } as OutputAsset,
          'tap\\asset-lock.json': {
            type: 'asset',
            source: Uint8Array.from(bytes),
          } as OutputAsset,
        },
      })
    ).rejects.toThrow('canonical snapshot spelling');

    expect(mockBuildAssetsMap).not.toHaveBeenCalled();
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
    const mockBuildResult: ReturnType<typeof buildAssetsMap> = {};

    mockLoadStaticAssets.mockResolvedValue(mockStaticAssets);
    mockBuildAssetsMap.mockReturnValue(mockBuildResult);

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
    const mockBuildResult: ReturnType<typeof buildAssetsMap> = {};

    mockLoadStaticAssets.mockResolvedValue(mockAssets);
    mockBuildAssetsMap.mockReturnValue(mockBuildResult);

    await extract_vite_assets_map(mockZephyrEngine, mockViteInternalOptions);

    const getAssetTypeFn = mockBuildAssetsMap.mock.calls[0][2];
    const chunkAsset: OutputChunk = { type: 'chunk' } as OutputChunk;

    expect(getAssetTypeFn(chunkAsset)).toBe('chunk');
  });

  it('should return correct asset type for asset', async () => {
    const mockAssets = {};
    const mockBuildResult: ReturnType<typeof buildAssetsMap> = {};

    mockLoadStaticAssets.mockResolvedValue(mockAssets);
    mockBuildAssetsMap.mockReturnValue(mockBuildResult);

    await extract_vite_assets_map(mockZephyrEngine, mockViteInternalOptions);

    const getAssetTypeFn = mockBuildAssetsMap.mock.calls[0][2];
    const outputAsset: OutputAsset = { type: 'asset' } as OutputAsset;

    expect(getAssetTypeFn(outputAsset)).toBe('asset');
  });
});

describe('extractBuffer', () => {
  it('should extract code from chunk assets', async () => {
    const mockAssets = {};
    const mockBuildResult: ReturnType<typeof buildAssetsMap> = {};

    mockLoadStaticAssets.mockResolvedValue(mockAssets);
    mockBuildAssetsMap.mockReturnValue(mockBuildResult);

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
    const mockBuildResult: ReturnType<typeof buildAssetsMap> = {};

    mockLoadStaticAssets.mockResolvedValue(mockAssets);
    mockBuildAssetsMap.mockReturnValue(mockBuildResult);

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
    const mockBuildResult: ReturnType<typeof buildAssetsMap> = {};

    mockLoadStaticAssets.mockResolvedValue(mockAssets);
    mockBuildAssetsMap.mockReturnValue(mockBuildResult);

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
    const mockBuildResult: ReturnType<typeof buildAssetsMap> = {};

    mockLoadStaticAssets.mockResolvedValue(mockAssets);
    mockBuildAssetsMap.mockReturnValue(mockBuildResult);

    await extract_vite_assets_map(mockZephyrEngine, mockViteInternalOptions);

    const extractBufferFn = mockBuildAssetsMap.mock.calls[0][1];
    const unknownAsset = { type: 'unknown' };

    expect(extractBufferFn(unknownAsset)).toBeUndefined();
  });
});
