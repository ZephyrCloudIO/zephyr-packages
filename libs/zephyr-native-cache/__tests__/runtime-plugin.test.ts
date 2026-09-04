import { describe, expect, it } from '@rstest/core';
import { extractManifestRelease } from '../src/runtime-plugin';

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
});
