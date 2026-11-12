import { describe, expect, it, rs } from '@rstest/core';

const { nativeCache } = rs.hoisted(() => ({
  nativeCache: {
    getDocumentDirectory: rs.fn(async () => '/docs'),
    readBundledFile: rs.fn(async (name: string) =>
      name === 'present.bundle' ? 'x' : null
    ),
  },
}));

rs.mock('../src/NativeMFECache', () => ({ default: nativeCache }));

import { register } from '../src/register';

const EMBEDDED_URL = 'https://zephyr-embedded.invalid/cart/exposed/Card.bundle';

describe('register with embedded remotes', () => {
  globalThis.__DEV__ = false;
  const load = rs.fn(async (_url: string) => undefined);
  globalThis.__ZEPHYR__ = {
    version: 1,
    runtime: { embeddedRemotes: { owns: () => true, load } },
  };
  const cacheLayer = register({ enablePolling: false });
  const refs = globalThis.__ZEPHYR__?.runtime.nativeCache?.refs;

  it('hands embedded bundle URLs to the embedded runtime', async () => {
    const fallback = rs.fn(async (_url: string) => undefined);

    await globalThis.__FEDERATION__.__NATIVE__.__CACHE__?.(fallback, EMBEDDED_URL);

    expect(load).toHaveBeenCalledWith(EMBEDDED_URL);
    expect(fallback).not.toHaveBeenCalled();
  });

  it('reports embedded loads in the cache status', () => {
    refs?.recordEmbeddedLoad?.(EMBEDDED_URL, 'cart');

    expect(cacheLayer.getStatus().remotes['cart']).toMatchObject({
      status: 'embedded',
      bundleUrl: EMBEDDED_URL,
    });
  });

  it('reads files from the app binary, undefined when missing', async () => {
    expect(await refs?.readBundledFile?.('present.bundle')).toBe('x');
    expect(await refs?.readBundledFile?.('missing.bundle')).toBeUndefined();
  });
});
