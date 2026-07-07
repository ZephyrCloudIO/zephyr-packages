import { rs } from '@rstest/core';

describe('vite-plugin-zephyr', () => {
  beforeEach(() => {
    // Fresh module registry per test so each dynamic import re-evaluates the
    // plugin with the mocks registered in that test (jest.isolateModules parity).
    rs.resetModules();
  });

  afterEach(() => {
    // Note: no doUnmock here — in rstest 0.8 doUnmock also disables later
    // doMock/doMockRequire registrations for the same specifier. Each test
    // registers its own mocks and resetModules gives it a fresh module graph.
    rs.clearAllMocks();
    rs.resetModules();
  });

  test('defaults Vite base to "./" on build so assets stay under path-addressed URLs', async () => {
    rs.doMock('vite', () => ({
      loadEnv: rs.fn(() => ({})),
    }));

    const { withZephyr } = (await import('./vite-plugin-zephyr')) as unknown as {
      withZephyr: () => Array<{
        name?: string;
        config: (config: object, env: { command: string; mode: string }) => unknown;
      }>;
    };

    const plugin = withZephyr().find((p) => p.name === 'with-zephyr');
    if (!plugin) throw new Error('with-zephyr plugin not found');

    // Unset base on build: default to relative so /__zephyr/v1/{v|t|e}/<key>/
    // deployments resolve assets against the document URL.
    expect(plugin.config({}, { command: 'build', mode: 'production' })).toEqual({
      base: './',
    });
    // Explicit base is the user's choice, even '/'.
    expect(plugin.config({ base: '/' }, { command: 'build', mode: 'production' })).toBe(
      null
    );
    expect(
      plugin.config({ base: '/my-app/' }, { command: 'build', mode: 'production' })
    ).toBe(null);
    // Dev server keeps Vite's default.
    expect(plugin.config({}, { command: 'serve', mode: 'development' })).toBe(null);
  });

  test('withZephyr without mfConfig does not load module federation', async () => {
    rs.doMock('vite', () => ({
      loadEnv: rs.fn(() => ({})),
    }));
    // The plugin loads @module-federation/vite via require(), so the CJS mock
    // registry is the one that intercepts it.
    rs.doMockRequire('@module-federation/vite', () => {
      throw new Error('module federation should not load');
    });

    const { withZephyr } = (await import('./vite-plugin-zephyr')) as unknown as {
      withZephyr: () => Array<{ name?: string }>;
    };

    const plugins = withZephyr();
    expect(plugins).toHaveLength(1);
    expect(plugins[0]?.name).toBe('with-zephyr');
  });

  test('withZephyr with mfConfig injects runtime plugin and delegates to mf plugin', async () => {
    rs.doMock('vite', () => ({
      loadEnv: rs.fn(() => ({})),
    }));
    const federation = rs.fn((config) => [
      {
        name: 'module-federation-vite',
        _options: config,
      },
    ]);

    rs.doMockRequire('@module-federation/vite', () => ({
      federation,
    }));

    const { withZephyr } = (await import('./vite-plugin-zephyr')) as unknown as {
      withZephyr: (options?: Record<string, unknown>) => Array<{
        name?: string;
        _options?: { runtimePlugins?: string[] };
      }>;
    };

    const plugins = withZephyr({
      mfConfig: {
        name: 'host',
      },
    });

    expect(federation).toHaveBeenCalledTimes(1);
    expect(federation.mock.calls[0]?.[0]?.runtimePlugins).toEqual(
      expect.arrayContaining(['virtual:zephyr-mf-runtime-plugin'])
    );
    expect(plugins.map((plugin) => plugin.name)).toEqual([
      'module-federation-vite',
      'with-zephyr',
    ]);
  });
});
