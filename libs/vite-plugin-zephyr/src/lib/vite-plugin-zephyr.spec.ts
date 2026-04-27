import { describe, expect, test } from '@rstest/core';
import { withZephyr } from './vite-plugin-zephyr';

describe('vite-plugin-zephyr', () => {
  test('withZephyr without mfConfig does not load module federation', () => {
    const plugins = withZephyr();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.name).toBe('with-zephyr');
  });

  test('withZephyr with mfConfig injects runtime plugin and delegates to mf plugin', () => {
    const plugins = withZephyr({
      mfConfig: {
        name: 'host',
      },
    });

    const pluginNames = plugins.map((plugin) => plugin.name);
    expect(pluginNames).toContain('module-federation-vite');
    expect(pluginNames.at(-1)).toBe('with-zephyr');

    const moduleFederationPlugin = plugins.find(
      (plugin) => plugin.name === 'module-federation-vite'
    );
    expect(moduleFederationPlugin).toMatchObject({
      _options: expect.objectContaining({
        runtimePlugins: expect.arrayContaining([
          'virtual:zephyr-mf-runtime-plugin',
        ]),
      }),
    });
  });
});
