import { beforeEach, describe, expect, rs, test } from '@rstest/core';

rs.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

import { extractBundleHashes, resolvePublicPathBase } from '../src/runtime-plugin';

describe('zephyr-native-cache runtime plugin URL helpers', () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
  });

  test('derives production bundle URLs from a path-addressed manifest route', () => {
    const hashes = extractBundleHashes(
      {
        metaData: {
          publicPath: 'auto',
          buildInfo: { hash: 'container-hash' },
          remoteEntry: { name: 'remoteEntry.bundle' },
        },
        exposes: [
          {
            name: 'StatsCard',
            hash: 'stats-hash',
            assets: { js: { sync: ['src/StatsCard.js'] } },
          },
        ],
        shared: [
          {
            hash: 'shared-hash',
            assets: { js: { sync: ['shared/react.js'] } },
          },
        ],
      },
      'https://host/__zephyr/v1/e/route-key/mf-manifest.json?cache=1#hash'
    );

    expect(Object.fromEntries(hashes)).toMatchObject({
      'https://host/__zephyr/v1/e/route-key/remoteEntry.bundle': 'container-hash',
      'https://host/__zephyr/v1/e/route-key/exposed/StatsCard.bundle?modulesOnly=true&runModule=false':
        'stats-hash',
      'https://host/__zephyr/v1/e/route-key/shared/react.bundle?modulesOnly=true&runModule=false':
        'shared-hash',
    });
  });

  test('keeps root-looking publicPath values under the manifest route base', () => {
    expect(
      resolvePublicPathBase(
        '/assets/',
        'https://host/__zephyr/v1/t/route-key/mf-manifest.json'
      )
    ).toBe('https://host/__zephyr/v1/t/route-key/assets/');
  });
});
