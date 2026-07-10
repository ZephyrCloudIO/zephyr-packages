import { describe, expect, it } from '@rstest/core';
import { getBundleCacheKey, getBundleCacheVariant } from '../src/cache-key';

describe('native bundle cache identity', () => {
  it('preserves Metro flags that change bundle content', () => {
    const entry = getBundleCacheKey(
      'https://edge.test/app.bundle?platform=ios&modulesOnly=false&runModule=true'
    );
    const split = getBundleCacheKey(
      'https://edge.test/app.bundle?platform=ios&modulesOnly=true&runModule=false'
    );

    expect(entry).not.toBe(split);
    expect(getBundleCacheVariant(entry)).not.toBe(getBundleCacheVariant(split));
  });

  it('canonicalizes ordering and removes only volatile cache busters', () => {
    expect(
      getBundleCacheKey(
        'https://edge.test/app.bundle?runModule=false&t=123&platform=android&modulesOnly=true'
      )
    ).toBe(
      getBundleCacheKey(
        'https://edge.test/app.bundle?modulesOnly=true&platform=android&runModule=false&t=999'
      )
    );
  });

  it('keeps platform variants isolated', () => {
    expect(getBundleCacheKey('https://edge.test/app.bundle?platform=ios')).not.toBe(
      getBundleCacheKey('https://edge.test/app.bundle?platform=android')
    );
  });
});
