import { describe, expect, it } from '@rstest/core';
import type { Source } from 'zephyr-edge-contract';
import { buildWebpackAssetMap } from './build-webpack-assets-map';

class OriginalSource {
  bufferCalls = 0;

  constructor(private readonly content: Buffer) {}

  size(): number {
    return this.content.length;
  }

  source(): Buffer {
    return this.content;
  }

  buffer(): Buffer {
    this.bufferCalls += 1;
    return this.content;
  }
}

class UnsupportedSource {
  size(): number {
    return 0;
  }
}

describe('buildWebpackAssetMap', () => {
  it('preserves opaque OriginalSource bytes for strict TAP publication', async () => {
    const binary = Buffer.from([0x00, 0xff, 0x89, 0x50, 0x4e, 0x47]);
    const source = new OriginalSource(binary);
    const assets = await buildWebpackAssetMap(
      {
        'assets/icon.bin': source as unknown as Source,
      },
      { failOnUnsupportedSource: true }
    );

    const asset = Object.values(assets)[0];
    expect(asset).toEqual(
      expect.objectContaining({
        path: 'assets/icon.bin',
        size: binary.length,
      })
    );
    expect(asset?.buffer).toBe(binary);
    expect(Buffer.compare(asset?.buffer as Buffer, binary)).toBe(0);
    expect(source.bufferCalls).toBe(1);
  });

  it('fails closed when a TAP artifact source has no readable bytes', async () => {
    await expect(
      buildWebpackAssetMap(
        {
          'assets/opaque.bin': new UnsupportedSource() as unknown as Source,
        },
        { failOnUnsupportedSource: true }
      )
    ).rejects.toThrow('Cannot publish TAP artifact "assets/opaque.bin"');
  });
});
