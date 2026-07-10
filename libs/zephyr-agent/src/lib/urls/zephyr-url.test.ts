import { describe, expect, test } from '@rstest/core';

import {
  appendZephyrUrlPath,
  getPathPreservingBaseUrl,
  resolveZephyrSiblingUrl,
  stripFederatedRemoteName,
} from './zephyr-url';

describe('path-preserving Zephyr URL helpers', () => {
  test.each([
    [
      'version',
      'https://host/__zephyr/v1/v/route-key/remoteEntry.js',
      'https://host/__zephyr/v1/v/route-key/zephyr-manifest.json',
    ],
    [
      'tag',
      'https://host/__zephyr/v1/t/route-key/remoteEntry.js',
      'https://host/__zephyr/v1/t/route-key/zephyr-manifest.json',
    ],
    [
      'environment',
      'https://host/__zephyr/v1/e/route-key/remoteEntry.js',
      'https://host/__zephyr/v1/e/route-key/zephyr-manifest.json',
    ],
  ])(
    'derives Zephyr manifest sibling URL for %s remote entries',
    (_, entry, manifest) => {
      expect(resolveZephyrSiblingUrl(entry)).toBe(manifest);
    }
  );

  test('preserves hostname-mode sibling URL behavior', () => {
    expect(
      resolveZephyrSiblingUrl('https://route-key-ze.worker.com/remoteEntry.js')
    ).toBe('https://route-key-ze.worker.com/zephyr-manifest.json');
  });

  test('anchors hostname-mode nested entries to the deployment root', () => {
    expect(
      resolveZephyrSiblingUrl('https://route-key-ze.worker.com/static/js/remoteEntry.js')
    ).toBe('https://route-key-ze.worker.com/zephyr-manifest.json');
  });

  test('anchors path-mode nested entries to the route base', () => {
    expect(
      resolveZephyrSiblingUrl(
        'https://host/__zephyr/v1/v/route-key/static/js/remoteEntry.js'
      )
    ).toBe('https://host/__zephyr/v1/v/route-key/zephyr-manifest.json');
  });

  test('preserves dotted route keys such as application uids', () => {
    expect(
      resolveZephyrSiblingUrl(
        'https://host/__zephyr/v1/e/app.project.org',
        'chunks/main.js'
      )
    ).toBe('https://host/__zephyr/v1/e/app.project.org/chunks/main.js');
  });

  test('derives Module Federation manifest siblings without dropping path mode route base', () => {
    expect(
      resolveZephyrSiblingUrl(
        'remote@https://host/__zephyr/v1/v/route-key/remoteEntry.js',
        '/mf-manifest.json'
      )
    ).toBe('https://host/__zephyr/v1/v/route-key/mf-manifest.json');
  });

  test('keeps remote host route bases when the reference URL does not look like a file', () => {
    expect(
      resolveZephyrSiblingUrl('https://host/__zephyr/v1/e/route-key', 'chunks/main.js')
    ).toBe('https://host/__zephyr/v1/e/route-key/chunks/main.js');
  });

  test('accepts leading slash and dot-relative sibling paths without escaping the route base', () => {
    const baseUrl = 'https://host/__zephyr/v1/e/route-key';

    expect(appendZephyrUrlPath(baseUrl, '/chunks/main.js')).toBe(
      'https://host/__zephyr/v1/e/route-key/chunks/main.js'
    );
    expect(appendZephyrUrlPath(baseUrl, './chunks/main.js')).toBe(
      'https://host/__zephyr/v1/e/route-key/chunks/main.js'
    );
  });

  test('documents v1 root-relative app asset boundary', () => {
    expect(
      new URL('/assets/app.js', 'https://host/__zephyr/v1/e/route-key/index.html').href
    ).toBe('https://host/assets/app.js');
    expect(
      resolveZephyrSiblingUrl(
        'https://host/__zephyr/v1/e/route-key/index.html',
        '/assets/zephyr-controlled.js'
      )
    ).toBe('https://host/__zephyr/v1/e/route-key/assets/zephyr-controlled.js');
  });

  test('removes query and hash from remote entries before deriving sibling URLs', () => {
    expect(
      resolveZephyrSiblingUrl(
        'https://host/__zephyr/v1/v/route-key/remoteEntry.js?cache=1#container'
      )
    ).toBe('https://host/__zephyr/v1/v/route-key/zephyr-manifest.json');
  });

  test('exposes the route base for chunks and other sibling assets', () => {
    expect(
      getPathPreservingBaseUrl('https://host/__zephyr/v1/t/route-key/remoteEntry.js')
    ).toBe('https://host/__zephyr/v1/t/route-key');
  });

  test('only strips remote name prefixes, not @ segments inside the URL path', () => {
    expect(
      stripFederatedRemoteName(
        'remote@https://host/__zephyr/v1/v/route-key/remoteEntry.js'
      )
    ).toBe('https://host/__zephyr/v1/v/route-key/remoteEntry.js');
    expect(
      stripFederatedRemoteName('https://cdn.example.com/@scope/remoteEntry.js')
    ).toBe('https://cdn.example.com/@scope/remoteEntry.js');
  });
});
