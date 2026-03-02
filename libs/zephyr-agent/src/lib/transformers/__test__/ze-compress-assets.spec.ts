import type { ZeBuildAssetsMap } from 'zephyr-edge-contract';
import { zeBuildAssets } from '../ze-build-assets';
import { compressWasmAssets } from '../ze-compress-assets';

function toMap(...assets: ReturnType<typeof zeBuildAssets>[]): ZeBuildAssetsMap {
  return assets.reduce((memo, asset) => {
    memo[asset.hash] = asset;
    return memo;
  }, {} as ZeBuildAssetsMap);
}

describe('compressWasmAssets', () => {
  it('compresses large wasm assets (>25MB) and marks gzip encoding', () => {
    const wasmAsset = zeBuildAssets({
      filepath: 'server.wasm',
      content: Buffer.alloc(26 * 1024 * 1024, 'A'),
    });

    const result = compressWasmAssets(toMap(wasmAsset));
    const compressedAsset = Object.values(result)[0];

    expect(compressedAsset.path).toBe('server.wasm');
    expect(compressedAsset.contentEncoding).toBe('gzip');
    expect(compressedAsset.size).toBeLessThan(wasmAsset.size);
    expect(compressedAsset.hash).not.toBe(wasmAsset.hash);
  });

  it('keeps non-wasm assets unchanged', () => {
    const jsAsset = zeBuildAssets({
      filepath: 'main.js',
      content: 'console.log("hello");',
    });

    const result = compressWasmAssets(toMap(jsAsset));
    const output = result[jsAsset.hash];

    expect(output).toBe(jsAsset);
    expect(output.contentEncoding).toBeUndefined();
  });

  it('keeps small wasm assets unchanged', () => {
    const tinyWasmAsset = zeBuildAssets({
      filepath: 'tiny.wasm',
      content: Buffer.from([0x00, 0x61]),
    });

    const result = compressWasmAssets(toMap(tinyWasmAsset));
    const output = result[tinyWasmAsset.hash];

    expect(output).toBe(tinyWasmAsset);
    expect(output.contentEncoding).toBeUndefined();
  });

  it('does not recompress already encoded assets', () => {
    const encodedAsset = zeBuildAssets({
      filepath: 'server.wasm',
      content: Buffer.from('A'.repeat(150_000)),
      contentEncoding: 'gzip',
    });

    const result = compressWasmAssets(toMap(encodedAsset));
    const output = result[encodedAsset.hash];

    expect(output).toBe(encodedAsset);
    expect(output.contentEncoding).toBe('gzip');
  });
});
