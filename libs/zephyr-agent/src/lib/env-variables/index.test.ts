import { describe, expect, test } from '@rstest/core';

import { buildEnvImportMap } from './index';

describe('buildEnvImportMap', () => {
  test('maps the application itself to its concrete deployment manifest', () => {
    expect(
      buildEnvImportMap(
        'host-app',
        [],
        'https://cdnedge.agoda.net/customer/mount/zephyr-manifest.json'
      )
    ).toMatchObject({
      'env:vars:host-app':
        'https://cdnedge.agoda.net/customer/mount/zephyr-manifest.json',
    });
  });

  test('keeps the same-origin self mapping when no deployment URL is available', () => {
    expect(buildEnvImportMap('host-app', [])).toMatchObject({
      'env:vars:host-app': '/zephyr-manifest.json',
    });
  });

  test('keeps path prefix for remote env manifest import map entries', () => {
    expect(
      buildEnvImportMap('host-app', [
        {
          name: 'remote',
          application_uid: 'remote-app',
          remote_entry_url: 'remote@https://host/__zephyr/v1/e/route-key/remoteEntry.js',
        },
      ])
    ).toMatchObject({
      'env:vars:remote-app': 'https://host/__zephyr/v1/e/route-key/zephyr-manifest.json',
    });
  });
});
