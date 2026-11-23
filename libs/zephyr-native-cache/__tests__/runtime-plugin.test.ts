import { describe, expect, it, rs } from '@rstest/core';
import runtimePlugin, { extractManifestRelease } from '../src/runtime-plugin';

describe('runtime plugin release extraction', () => {
  it('keeps the complete executable graph, including artifacts with missing hashes', () => {
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
    const release = extractManifestRelease(
      {
        metaData: {
          publicPath: 'https://edge.example/assets',
          buildInfo: { hash: 'a'.repeat(64) },
          remoteEntry: { name: 'remote.bundle', path: 'entries' },
        },
        exposes: [
          {
            name: 'Card',
            hash: 'b'.repeat(64),
            assets: { js: { sync: ['src/Card.js'] } },
          },
        ],
        shared: [
          {
            name: 'library',
            assets: { js: { sync: ['shared/library.js'] } },
          },
        ],
      },
      'https://edge.example/mf-manifest.json',
      'remote',
      'https://edge.example/assets/entries/remote.bundle'
    );

    expect(release.manifestId).toBe('remote');
    expect(release.artifacts.map((artifact) => artifact.kind).sort()).toEqual([
      'container',
      'exposed',
      'shared',
    ]);
    expect(
      release.artifacts.find((artifact) => artifact.kind === 'shared')?.expectedHash
    ).toBeUndefined();
  });

  it('derives a polled container URL from the newly fetched manifest', () => {
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
    const release = extractManifestRelease(
      {
        metaData: {
          publicPath: 'https://new-edge.example/v2',
          buildInfo: { hash: 'c'.repeat(64) },
          remoteEntry: { name: 'remote.bundle', path: 'entries' },
        },
        exposes: [],
        shared: [],
      },
      'https://control.example/mf-manifest.json',
      'remote'
    );

    expect(release.artifacts).toContainEqual({
      bundleUrl: 'https://new-edge.example/v2/entries/remote.bundle',
      expectedHash: 'c'.repeat(64),
      kind: 'container',
    });
  });

  it('rejects asynchronous executable assets', () => {
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;

    expect(() =>
      extractManifestRelease(
        {
          metaData: {
            publicPath: 'https://edge.example',
            buildInfo: { hash: 'a'.repeat(64) },
            remoteEntry: { name: 'remote.bundle' },
          },
          exposes: [
            {
              name: 'Card',
              hash: 'b'.repeat(64),
              assets: { js: { async: ['async/Card.js'] } },
            },
          ],
          shared: [],
        },
        'https://edge.example/mf-manifest.json',
        'remote'
      )
    ).toThrow('unverifiable async JavaScript');
  });

  it('rejects shared modules represented by multiple executable files', () => {
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;

    expect(() =>
      extractManifestRelease(
        {
          metaData: {
            publicPath: 'https://edge.example',
            buildInfo: { hash: 'a'.repeat(64) },
            remoteEntry: { name: 'remote.bundle' },
          },
          exposes: [],
          shared: [
            {
              name: 'library',
              hash: 'b'.repeat(64),
              assets: { js: { sync: ['shared/a.js', 'shared/b.js'] } },
            },
          ],
        },
        'https://edge.example/mf-manifest.json',
        'remote'
      )
    ).toThrow('not one verifiable artifact');
  });

  it('propagates an invalid online manifest instead of treating it as offline', () => {
    (globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = false;
    const manifestUrl = 'https://edge.example/mf-manifest.json';
    const cacheLayer = {
      registerManifestRelease: rs.fn(),
      registerManifestSource: rs.fn(),
      getCachedManifest: rs.fn(),
    };
    const originalZephyr = globalThis.__ZEPHYR__;
    (
      globalThis as typeof globalThis & {
        __ZEPHYR__: {
          version: 1;
          runtime: { nativeCache: { refs: { cacheLayer: typeof cacheLayer } } };
        };
      }
    ).__ZEPHYR__ = {
      version: 1,
      runtime: { nativeCache: { refs: { cacheLayer } } },
    };
    const plugin = runtimePlugin();
    const args = {
      origin: {
        snapshotHandler: {
          manifestCache: new Map([
            [
              manifestUrl,
              {
                metaData: {
                  publicPath: 'https://edge.example',
                  buildInfo: { hash: 'a'.repeat(64) },
                  remoteEntry: { name: 'remote.bundle' },
                },
                exposes: [],
                shared: [
                  {
                    name: 'library',
                    hash: 'b'.repeat(64),
                    assets: { js: { sync: [null as unknown as string] } },
                  },
                ],
              },
            ],
          ]),
        },
      },
      remote: { entry: manifestUrl },
      remoteInfo: {
        name: 'remote',
        entry: 'https://edge.example/remote.bundle',
      },
    };

    try {
      expect(() => plugin.afterResolve!(args as never)).toThrow('replace');
      expect(cacheLayer.registerManifestRelease).not.toHaveBeenCalled();
    } finally {
      globalThis.__ZEPHYR__ = originalZephyr;
    }
  });

  it('serves the verified cached manifest when the network is offline', async () => {
    const manifest = {
      metaData: {
        publicPath: 'https://edge.example',
        buildInfo: { hash: 'a'.repeat(64) },
        remoteEntry: { name: 'remote.bundle' },
      },
      exposes: [],
      shared: [],
    };
    const cacheLayer = {
      registerManifestRelease: rs.fn(),
      registerManifestSource: rs.fn(),
      getCachedManifest: rs.fn(async () => manifest),
    };
    const originalFetch = globalThis.fetch;
    const originalZephyr = globalThis.__ZEPHYR__;
    globalThis.fetch = rs.fn(async () => {
      throw new Error('offline');
    });
    (
      globalThis as typeof globalThis & {
        __ZEPHYR__: {
          version: 1;
          runtime: { nativeCache: { refs: { cacheLayer: typeof cacheLayer } } };
        };
      }
    ).__ZEPHYR__ = {
      version: 1,
      runtime: { nativeCache: { refs: { cacheLayer } } },
    };

    try {
      const plugin = runtimePlugin();
      const response = await plugin.fetch!(
        'https://edge.example/mf-manifest.json',
        {},
        undefined,
        { resourceType: 'manifest' } as never
      );
      expect(response).toBeInstanceOf(Response);
      expect(await (response as Response).json()).toEqual(manifest);
    } finally {
      globalThis.fetch = originalFetch;
      globalThis.__ZEPHYR__ = originalZephyr;
    }
  });
});
