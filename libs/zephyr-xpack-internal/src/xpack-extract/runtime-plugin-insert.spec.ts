import { describe, expect, it } from '@rstest/core';
import type { ModuleFederationPlugin, XFederatedRemotesConfig } from '../xpack.types';
import { configureZephyrRuntimePlugin } from './runtime-plugin-insert';

const runtimePluginPath = '/virtual/zephyr-runtime-plugin.js';

describe('configureZephyrRuntimePlugin', () => {
  it('adds the runtime plugin to the original enhanced MF options', () => {
    const options: XFederatedRemotesConfig = { name: 'host' };
    const plugin: ModuleFederationPlugin = { apply() {}, _options: options };

    expect(configureZephyrRuntimePlugin(plugin, runtimePluginPath)).toBe(true);
    expect(options.runtimePlugins).toEqual([runtimePluginPath]);
  });

  it('adds the runtime plugin to a wrapped MF config', () => {
    const config: XFederatedRemotesConfig = { name: 'host' };
    const plugin: ModuleFederationPlugin = {
      apply() {},
      options: { config },
    };

    expect(configureZephyrRuntimePlugin(plugin, runtimePluginPath)).toBe(true);
    expect(config.runtimePlugins).toEqual([runtimePluginPath]);
  });
});
