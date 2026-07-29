import { describe, expect, test } from '@rstest/core';

import {
  ensureRuntimePlugin,
  ZEPHYR_MF_RUNTIME_PLUGIN_ID,
  type ModuleFederationRuntimePlugin,
} from '../ensure_runtime_plugin';

function pluginPath(entry: ModuleFederationRuntimePlugin): string {
  return Array.isArray(entry) ? entry[0] : entry;
}

describe('ensureRuntimePlugin', () => {
  test('adds the zephyr runtime plugin when missing', () => {
    const mfConfig = ensureRuntimePlugin({
      name: 'host',
    });

    expect(mfConfig.runtimePlugins).toEqual(
      expect.arrayContaining(['virtual:zephyr-mf-runtime-plugin'])
    );
  });

  test('does not duplicate the zephyr runtime plugin', () => {
    const first = ensureRuntimePlugin({
      name: 'host',
    });
    const second = ensureRuntimePlugin(first);
    const matches = second.runtimePlugins?.filter(
      (plugin) => pluginPath(plugin) === ZEPHYR_MF_RUNTIME_PLUGIN_ID
    );

    expect(matches).toHaveLength(1);
  });

  test('inserts the runtime plugin as a tuple with the manifest URL', () => {
    const mfConfig = ensureRuntimePlugin(
      { name: 'host' },
      'https://cdn.example.test/customer/app/zephyr-manifest.json'
    );

    expect(mfConfig.runtimePlugins).toEqual([
      [
        ZEPHYR_MF_RUNTIME_PLUGIN_ID,
        {
          manifestUrl: 'https://cdn.example.test/customer/app/zephyr-manifest.json',
        },
      ],
    ]);
  });

  test('recognizes a configured tuple without adding a second bare plugin', () => {
    const mfConfig = ensureRuntimePlugin({
      name: 'host',
      runtimePlugins: [[ZEPHYR_MF_RUNTIME_PLUGIN_ID, { configured: true }]],
    });

    expect(mfConfig.runtimePlugins).toEqual([
      [ZEPHYR_MF_RUNTIME_PLUGIN_ID, { configured: true }],
    ]);
  });

  test('upgrades the captured runtime plugin array in place', () => {
    const runtimePlugins: ModuleFederationRuntimePlugin[] = [ZEPHYR_MF_RUNTIME_PLUGIN_ID];
    const mfConfig = { name: 'host', runtimePlugins };

    ensureRuntimePlugin(mfConfig, 'https://cdn.example.test/mount/zephyr-manifest.json');

    expect(mfConfig.runtimePlugins).toBe(runtimePlugins);
    expect(runtimePlugins).toEqual([
      [
        ZEPHYR_MF_RUNTIME_PLUGIN_ID,
        { manifestUrl: 'https://cdn.example.test/mount/zephyr-manifest.json' },
      ],
    ]);
  });
});
