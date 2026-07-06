import { buildEnvImportMap } from './index';

describe('buildEnvImportMap', () => {
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
