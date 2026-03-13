import { randomFillSync } from 'node:crypto';
import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { zeBuildAssets } from '../ze-build-assets';
import { compressLargeAssets } from '../ze-compress-assets';

function toMap(...assets: ReturnType<typeof zeBuildAssets>[]): ZeBuildAssetsMap {
  return assets.reduce((memo, asset) => {
    memo[asset.hash] = asset;
    return memo;
  }, {} as ZeBuildAssetsMap);
}

describe('compressLargeAssets', () => {
  it('compresses large assets (>25MB) and marks gzip encoding', () => {
    const largeJsAsset = zeBuildAssets({
      filepath: 'large.js',
      content: Buffer.alloc(26 * 1024 * 1024, 'A'),
    });

    const result = compressLargeAssets(toMap(largeJsAsset));
    const compressedAsset = Object.values(result)[0];

    expect(compressedAsset.path).toBe('large.js');
    expect(compressedAsset.contentEncoding).toBe('gzip');
    expect(compressedAsset.size).toBeLessThan(largeJsAsset.size);
    expect(compressedAsset.hash).not.toBe(largeJsAsset.hash);
  });

  it('keeps small assets unchanged', () => {
    const jsAsset = zeBuildAssets({
      filepath: 'main.js',
      content: 'console.log("hello");',
    });

    const result = compressLargeAssets(toMap(jsAsset));
    const output = result[jsAsset.hash];

    expect(output).toBe(jsAsset);
    expect(output.contentEncoding).toBeUndefined();
  });

  it('keeps large incompressible assets unchanged', () => {
    const incompressible = Buffer.alloc(26 * 1024 * 1024);
    randomFillSync(incompressible);
    const largeAsset = zeBuildAssets({
      filepath: 'large.bin',
      content: incompressible,
    });

    const result = compressLargeAssets(toMap(largeAsset));
    const output = result[largeAsset.hash];

    expect(output).toBe(largeAsset);
    expect(output.contentEncoding).toBeUndefined();
  });

  it('does not recompress already encoded assets', () => {
    const encodedAsset = zeBuildAssets({
      filepath: 'large.js',
      content: Buffer.from('A'.repeat(150_000)),
      contentEncoding: 'gzip',
    });

    const result = compressLargeAssets(toMap(encodedAsset));
    const output = result[encodedAsset.hash];

    expect(output).toBe(encodedAsset);
    expect(output.contentEncoding).toBe('gzip');
  });
});
