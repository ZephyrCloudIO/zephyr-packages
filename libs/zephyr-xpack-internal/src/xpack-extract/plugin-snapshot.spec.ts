import { describe, expect, it } from '@rstest/core';
import { restorePlugins, snapshotPlugins } from './plugin-snapshot';

describe('plugin snapshots', () => {
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
