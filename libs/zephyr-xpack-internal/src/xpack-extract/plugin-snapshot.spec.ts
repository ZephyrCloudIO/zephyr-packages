import { describe, expect, it } from '@rstest/core';
import { restorePlugins, snapshotPlugins } from './plugin-snapshot';
import { configureZephyrRuntimePlugin } from './runtime-plugin-insert';
import type { ModuleFederationPlugin, XFederatedRemotesConfig } from '../xpack.types';

describe('plugin snapshots', () => {
  it('ignores non-federation plugins without a prototype', () => {
    const plugin = Object.assign(Object.create(null), { apply() {} });
    const config = { plugins: [plugin] };
    const snapshot = snapshotPlugins([config]);
    expect(() => restorePlugins([config], snapshot)).not.toThrow();
    expect(config.plugins).toEqual([plugin]);
  });

  it('restores other fields and plugin lists when an array cannot be restored', () => {
    const options = {
      name: 'host',
      remotes: { remote: 'remote@http://localhost:3001/remoteEntry.js' },
      runtimePlugins: ['user-runtime'],
    };
    const plugin = { name: 'ModuleFederationPlugin', apply() {}, _options: options };
    const config = { plugins: [plugin] };
    const snapshot = snapshotPlugins([config]);
    options.runtimePlugins.push('zephyr-runtime');
    Object.freeze(options.runtimePlugins);
    options.remotes.remote = 'remote@https://example.test/remoteEntry.js';
    config.plugins.push({ name: 'ZephyrPlugin', apply() {}, _options: options });

    expect(() => restorePlugins([config], snapshot)).not.toThrow();
    expect(options.remotes.remote).toBe('remote@http://localhost:3001/remoteEntry.js');
    expect(config.plugins).toEqual([plugin]);
  });

  it('leaves unchanged frozen federation fields intact', () => {
    const options = Object.freeze({
      name: 'host',
      remotes: Object.freeze({ remote: 'remote@http://localhost:3001/remoteEntry.js' }),
      runtimePlugins: Object.freeze(['user-runtime']),
    });
    const config = { plugins: [{ name: 'ModuleFederationPlugin', _options: options }] };
    const snapshot = snapshotPlugins([config]);
    expect(() => restorePlugins([config], snapshot)).not.toThrow();
    expect(config.plugins[0]?._options).toBe(options);
  });

  it.each(['_options', 'options', 'config'] as const)(
    'restores mutated remotes and runtime plugins in %s without replacing the plugin',
    (key) => {
      const remotes = { remote: 'remote@http://localhost:3001/remoteEntry.js' };
      const runtimePlugins = ['user-runtime'];
      const options: XFederatedRemotesConfig = { name: 'host', remotes, runtimePlugins };
      const plugin: ModuleFederationPlugin = {
        name: 'ModuleFederationPlugin',
        apply() {},
        [key]: options,
      };
      const config = { plugins: [plugin] };
      const snapshot = snapshotPlugins([config]);

      remotes.remote = 'remote@https://example.test/remoteEntry.js';
      configureZephyrRuntimePlugin(plugin, 'zephyr-runtime');
      restorePlugins([config], snapshot);

      expect(config.plugins[0]).toBe(plugin);
      expect(options.remotes).toBe(remotes);
      expect(remotes.remote).toBe('remote@http://localhost:3001/remoteEntry.js');
      expect(options.runtimePlugins).toBe(runtimePlugins);
      expect(runtimePlugins).toEqual(['user-runtime']);
    }
  );

  it('restores Nx wrapped remotes and removes runtime fields created during setup', () => {
    const remotes = ['remote@http://localhost:3001/remoteEntry.js'];
    const plugin: ModuleFederationPlugin = {
      name: 'NxModuleFederationPlugin',
      apply() {},
      _options: { config: { name: 'host', remotes } },
      configOverride: undefined,
    };
    const config = { plugins: [plugin] };
    const snapshot = snapshotPlugins([config]);

    remotes.splice(0, 1, 'remote@https://example.test/remoteEntry.js');
    configureZephyrRuntimePlugin(plugin, 'zephyr-runtime');
    restorePlugins([config], snapshot);

    expect(remotes).toEqual(['remote@http://localhost:3001/remoteEntry.js']);
    expect(plugin.configOverride).toBeUndefined();
  });

  it('removes newly inserted runtimePlugins and restores existing Nx overrides', () => {
    const options = { name: 'host' };
    const override = { runtimePlugins: ['user-runtime'] };
    const plugins: ModuleFederationPlugin[] = [
      { name: 'ModuleFederationPlugin', apply() {}, _options: options },
      {
        name: 'NxModuleFederationPlugin',
        apply() {},
        options: { config: { name: 'host' } },
        configOverride: override,
      },
    ];
    const config = { plugins };
    const snapshot = snapshotPlugins([config]);
    for (const plugin of plugins) configureZephyrRuntimePlugin(plugin, 'zephyr-runtime');
    restorePlugins([config], snapshot);

    expect(Object.hasOwn(options, 'runtimePlugins')).toBe(false);
    expect(plugins[1]?.configOverride).toBe(override);
    expect(override.runtimePlugins).toEqual(['user-runtime']);
  });

  it('removes every plugin added after the snapshot and keeps the list identity', () => {
    const existing = { name: 'existing' };
    const withPlugins: { plugins?: unknown[] } = { plugins: [existing] };
    const withoutPlugins: { plugins?: unknown[] } = {};
    const configs = [withPlugins, withoutPlugins];
    const list = withPlugins.plugins;

    const snapshot = snapshotPlugins(configs);
    withPlugins.plugins!.push({ name: 'zephyr' });
    withoutPlugins.plugins = [{ name: 'zephyr' }];
    restorePlugins(configs, snapshot);

    expect(withPlugins.plugins).toBe(list);
    expect(withPlugins.plugins).toEqual([existing]);
    expect('plugins' in withoutPlugins).toBe(false);
  });

  it('is unaffected by later edits to the config it captured', () => {
    const config: { plugins?: unknown[] } = { plugins: ['a'] };
    const snapshot = snapshotPlugins([config]);

    config.plugins!.push('b');
    config.plugins!.shift();
    restorePlugins([config], snapshot);

    expect(config.plugins).toEqual(['a']);
  });

  it('recreates a list that was replaced rather than mutated', () => {
    const config: { plugins?: unknown[] } = { plugins: ['a'] };
    const snapshot = snapshotPlugins([config]);

    delete config.plugins;
    restorePlugins([config], snapshot);

    expect(config.plugins).toEqual(['a']);
  });
});
