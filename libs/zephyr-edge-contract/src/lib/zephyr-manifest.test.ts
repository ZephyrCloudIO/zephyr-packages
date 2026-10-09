import { describe, expect, it } from '@rstest/core';
import {
  getHashedZephyrManifestFilename,
  getHashedZephyrManifestPath,
  isZephyrManifestHash,
  ZEPHYR_MANIFEST_FILENAME,
  ZEPHYR_MANIFEST_META_NAME,
} from './zephyr-manifest';

const GOLDEN_HASH = 'd4a258c39d27c7abb51b1999af770744f4f0e63cf5f112acb46f6af8d81a9e12';

describe('Zephyr manifest addressing', () => {
  it('formats the golden hash using the stable logical filename', () => {
    expect(ZEPHYR_MANIFEST_FILENAME).toBe('zephyr-manifest.json');
    expect(ZEPHYR_MANIFEST_META_NAME).toBe('zephyr-manifest');
    expect(isZephyrManifestHash(GOLDEN_HASH)).toBe(true);
    expect(getHashedZephyrManifestFilename(GOLDEN_HASH)).toBe(
      `zephyr-manifest.${GOLDEN_HASH}.json`
    );
    expect(getHashedZephyrManifestPath(GOLDEN_HASH)).toBe(
      `/zephyr-manifest.${GOLDEN_HASH}.json`
    );
  });

  it.each([
    GOLDEN_HASH.toUpperCase(),
    GOLDEN_HASH.slice(1),
    `${GOLDEN_HASH}0`,
    `${'0'.repeat(63)}g`,
  ])('rejects noncanonical hash %s', (hash) => {
    expect(isZephyrManifestHash(hash)).toBe(false);
    expect(() => getHashedZephyrManifestPath(hash)).toThrow(TypeError);
  });
});
