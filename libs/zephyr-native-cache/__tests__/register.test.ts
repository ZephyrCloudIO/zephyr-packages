import { beforeEach, describe, expect, it, rs } from '@rstest/core';

const nativeCache = rs.hoisted(() => ({
  deleteFile: rs.fn(async () => undefined),
  downloadFile: rs.fn(),
  fileExists: rs.fn(async () => false),
  getCacheDirectory: rs.fn(async () => '/application-support'),
  getDocumentDirectory: rs.fn(async () => '/documents'),
  getFileSize: rs.fn(async () => 0),
  readFile: rs.fn(),
  readVerifiedFile: rs.fn(),
  restart: rs.fn(),
  sha256File: rs.fn(),
  sha256String: rs.fn(async () => 'a'.repeat(64)),
  writeFile: rs.fn(async () => undefined),
}));

rs.mock('../src/NativeMFECache', () => ({ default: nativeCache }));

import { NativeCacheLoadError } from '../src/NativeCacheError';
import { register } from '../src/register';

describe('register fail-closed bridge', () => {
  beforeEach(() => {
    rs.clearAllMocks();
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
  });

  it('never invokes the ordinary network fallback after an integrity failure', async () => {
    register({ enablePolling: false, forceCacheInDev: true });
    const fallback = rs.fn(async () => undefined);
    const cacheHandler = (
      globalThis as typeof globalThis & {
        __FEDERATION__: {
          __NATIVE__: {
            __CACHE__?: (
              fallback: (bundlePath: string) => Promise<void>,
              bundlePath: string
            ) => Promise<void>;
          };
        };
      }
    ).__FEDERATION__.__NATIVE__.__CACHE__;

    const request = cacheHandler!(
      fallback,
      'https://edge.example/unregistered.bundle?token=sensitive'
    );

    await expect(request).rejects.toBeInstanceOf(NativeCacheLoadError);
    expect(fallback).not.toHaveBeenCalled();
  });
});
