import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const { files, nativeCache } = rs.hoisted(() => {
  const files = new Map<string, string>();
  return {
    files,
    nativeCache: {
      fileExists: rs.fn(async (file: string) => files.has(file)),
      getDocumentDirectory: rs.fn(async () => '/docs'),
      readFile: rs.fn(async (file: string) => files.get(file)!),
      sha256String: rs.fn(async (value: string) => `h${value.length}`),
      writeFile: rs.fn(async (file: string, value: string) => {
        files.set(file, value);
      }),
    },
  };
});

rs.mock('../src/NativeMFECache', () => ({ default: nativeCache }));

import { createNativeEnvStorage } from '../src/env-storage';

const MANIFEST_URL = 'https://a/zephyr-manifest.json';
const STORAGE_PATH = '/docs/zephyr-env-h30.json';

describe('createNativeEnvStorage', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    files.clear();
  });

  it('writes manifest values to a key-addressed file', async () => {
    const storage = createNativeEnvStorage();
    expect(storage).toBeDefined();

    await storage!.setItem(MANIFEST_URL, 'v');

    expect(nativeCache.writeFile).toHaveBeenCalledWith(STORAGE_PATH, 'v', 'utf8');
  });

  it('reads values back from the native file store', async () => {
    const storage = createNativeEnvStorage();
    await storage!.setItem(MANIFEST_URL, 'v');

    await expect(storage!.getItem(MANIFEST_URL)).resolves.toBe('v');
    expect(nativeCache.readFile).toHaveBeenCalledWith(STORAGE_PATH, 'utf8');
  });

  it('returns undefined when a key has no stored file', async () => {
    const storage = createNativeEnvStorage();

    await expect(storage!.getItem('missing')).resolves.toBeUndefined();
    expect(nativeCache.readFile).not.toHaveBeenCalled();
  });
});
