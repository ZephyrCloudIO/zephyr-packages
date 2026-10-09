import { describe, expect, it } from '@rstest/core';
import {
  getHashedZephyrManifestFilename,
  ZEPHYR_MANIFEST_FILENAME,
} from 'zephyr-edge-contract';
import { calculateManifestHash } from '../env-variables';
import { createManifestAsset } from './ze-create-manifest';

const GOLDEN_CONTENT =
  '{"version":"1.0.0","timestamp":"2026-08-10T12:34:56.789Z","dependencies":{},"zeVars":{"ZE_PUBLIC_GREETING":"Olá 世界"}}';
const GOLDEN_HASH = 'd4a258c39d27c7abb51b1999af770744f4f0e63cf5f112acb46f6af8d81a9e12';

describe('createManifestAsset', () => {
  it('uses exact UTF-8 bytes and the logical filename for canonical addressing', () => {
    const asset = createManifestAsset(GOLDEN_CONTENT);

    expect(Buffer.byteLength(GOLDEN_CONTENT, 'utf8')).toBe(122);
    expect(calculateManifestHash(GOLDEN_CONTENT)).toBe(GOLDEN_HASH);
    expect(asset).toMatchObject({
      path: ZEPHYR_MANIFEST_FILENAME,
      hash: GOLDEN_HASH,
      size: 122,
    });
    expect(asset.buffer.equals(Buffer.from(GOLDEN_CONTENT, 'utf8'))).toBe(true);
    expect(getHashedZephyrManifestFilename(asset.hash)).toBe(
      `zephyr-manifest.${GOLDEN_HASH}.json`
    );
  });
});
