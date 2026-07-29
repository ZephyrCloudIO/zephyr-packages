import { describe, expect, it } from '@rstest/core';
import type { ModuleFederationPlugin, XFederatedRemotesConfig } from '../xpack.types';
import { configureZephyrRuntimePlugin } from './runtime-plugin-insert';

const ZEPHYR_RUNTIME_PLUGIN_PATH = '/virtual/zephyr-runtime-plugin.js';

function pluginWithConfig(config: XFederatedRemotesConfig): ModuleFederationPlugin {
  return { apply() {}, _options: config };
}

describe('configureZephyrRuntimePlugin', () => {
  it('persists a tuple with the resolved self manifest URL on the mutable MF config', () => {
    const config: XFederatedRemotesConfig = { name: 'host' };

    expect(
      configureZephyrRuntimePlugin(
        pluginWithConfig(config),
        ZEPHYR_RUNTIME_PLUGIN_PATH,
        'https://cdn.example.test/customer/app/zephyr-manifest.json'
      )
    ).toBe(true);

    expect(config.runtimePlugins).toEqual([
      [
        expect.stringContaining('runtime-plugin'),
        {
          manifestUrl: 'https://cdn.example.test/customer/app/zephyr-manifest.json',
        },
      ],
    ]);
  });

  it('recognizes an existing tuple and does not add a second bare plugin', () => {
    const config: XFederatedRemotesConfig = {
      name: 'host',
      runtimePlugins: [[ZEPHYR_RUNTIME_PLUGIN_PATH, { configured: true }]],
    };

    configureZephyrRuntimePlugin(pluginWithConfig(config), ZEPHYR_RUNTIME_PLUGIN_PATH);

    expect(config.runtimePlugins).toEqual([
      [ZEPHYR_RUNTIME_PLUGIN_PATH, { configured: true }],
    ]);
  });

  it('upgrades an existing tuple in place while preserving its other options', () => {
    const config: XFederatedRemotesConfig = {
      name: 'host',
      runtimePlugins: [
        [
          ZEPHYR_RUNTIME_PLUGIN_PATH,
          { configured: true, manifestUrl: 'https://old.example.test' },
        ],
      ],
    };

    configureZephyrRuntimePlugin(
      pluginWithConfig(config),
      ZEPHYR_RUNTIME_PLUGIN_PATH,
      'https://cdn.example.test/mount/zephyr-manifest.json'
    );

    expect(config.runtimePlugins).toEqual([
      [
        ZEPHYR_RUNTIME_PLUGIN_PATH,
        {
          configured: true,
          manifestUrl: 'https://cdn.example.test/mount/zephyr-manifest.json',
        },
      ],
    ]);
  });

  it('mutates wrapped config objects instead of a normalized copy', () => {
    const config: XFederatedRemotesConfig = { name: 'host' };
    const plugin: ModuleFederationPlugin = {
      apply() {},
      _options: { config },
    };

    configureZephyrRuntimePlugin(plugin, ZEPHYR_RUNTIME_PLUGIN_PATH);

    expect(config.runtimePlugins).toEqual([expect.stringContaining('runtime-plugin')]);
  });

  it('writes Nx tuples to configOverride while preserving its existing plugins', () => {
    const plugin: ModuleFederationPlugin = {
      apply() {},
      _options: {
        config: {
          name: 'host',
          runtimePlugins: ['/plugins/base-runtime-ignored-by-nx.js'],
        },
      },
      configOverride: {
        runtimePlugins: ['/plugins/customer-runtime.js'],
      },
    };

    configureZephyrRuntimePlugin(
      plugin,
      ZEPHYR_RUNTIME_PLUGIN_PATH,
      'https://cdn.example.test/app/zephyr-manifest.json'
    );

    expect(plugin.configOverride?.runtimePlugins).toEqual([
      '/plugins/customer-runtime.js',
      [
        ZEPHYR_RUNTIME_PLUGIN_PATH,
        { manifestUrl: 'https://cdn.example.test/app/zephyr-manifest.json' },
      ],
    ]);
    expect(
      (plugin._options as { config: XFederatedRemotesConfig }).config.runtimePlugins
    ).toEqual(['/plugins/base-runtime-ignored-by-nx.js']);
  });

  it('creates an Nx configOverride tuple when the override starts undefined', () => {
    const plugin: ModuleFederationPlugin = {
      apply() {},
      _options: { config: { name: 'host' } },
      configOverride: undefined,
    };

    configureZephyrRuntimePlugin(
      plugin,
      ZEPHYR_RUNTIME_PLUGIN_PATH,
      'https://cdn.example.test/app/zephyr-manifest.json'
    );

    expect(plugin.configOverride?.runtimePlugins).toEqual([
      [
        ZEPHYR_RUNTIME_PLUGIN_PATH,
        { manifestUrl: 'https://cdn.example.test/app/zephyr-manifest.json' },
      ],
    ]);
  });
});
