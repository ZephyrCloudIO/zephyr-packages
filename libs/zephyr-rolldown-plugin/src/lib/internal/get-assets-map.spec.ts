import { describe, expect, it } from '@rstest/core';
import { getAssetsMap } from './get-assets-map';

describe('Rolldown asset mapping', () => {
  it('preserves non-UTF-8 PNG and lock bytes as Buffers', () => {
    const pngBytes = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x80,
    ]);
    const lockBytes = Uint8Array.from([0xff, 0x00, 0x80, 0xfe, 0x7f]);
    const assetsMap = getAssetsMap({
      'assets/icon.png': {
        type: 'asset',
        fileName: 'assets/icon.png',
        source: pngBytes,
      },
      'manifest.tap.lock': {
        type: 'asset',
        fileName: 'manifest.tap.lock',
        source: lockBytes,
      },
    } as never);

    const pngAsset = Object.values(assetsMap).find(
      (asset) => asset.path === 'assets/icon.png'
    );
    const lockAsset = Object.values(assetsMap).find(
      (asset) => asset.path === 'manifest.tap.lock'
    );

    expect(Buffer.isBuffer(pngAsset?.buffer)).toBe(true);
    expect(pngAsset?.buffer).toEqual(Buffer.from(pngBytes));
    expect(Buffer.isBuffer(lockAsset?.buffer)).toBe(true);
    expect(lockAsset?.buffer).toEqual(Buffer.from(lockBytes));
  });
});
