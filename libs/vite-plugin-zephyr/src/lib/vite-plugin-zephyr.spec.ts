describe('vite-plugin-zephyr', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.unmock('@module-federation/vite');
  });

  test('withZephyr without mfConfig does not load module federation', () => {
    jest.isolateModules(() => {
      jest.doMock('vite', () => ({
        loadEnv: jest.fn(() => ({})),
      }));
      jest.doMock('@module-federation/vite', () => {
        throw new Error('module federation should not load');
      });

      const { withZephyr } = require('./vite-plugin-zephyr') as {
        withZephyr: () => Array<{ name?: string }>;
      };

      const plugins = withZephyr();
      expect(plugins).toHaveLength(1);
      expect(plugins[0]?.name).toBe('with-zephyr');
    });
  });

  test('withZephyr with mfConfig injects runtime plugin and delegates to mf plugin', () => {
    jest.isolateModules(() => {
      jest.doMock('vite', () => ({
        loadEnv: jest.fn(() => ({})),
      }));
      const federation = jest.fn((config) => [
        {
          name: 'module-federation-vite',
          _options: config,
        },
      ]);

      jest.doMock('@module-federation/vite', () => ({
        federation,
      }));

      const { withZephyr } = require('./vite-plugin-zephyr') as {
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

  test('withZephyr runtime virtual module resolves runtime plugin via plugin dependency graph', async () => {
    let loadVirtualRuntimePlugin:
      | ((id: string) => Promise<string | null> | string | null)
      | undefined;

    jest.isolateModules(() => {
      jest.doMock('vite', () => ({
        loadEnv: jest.fn(() => ({})),
      }));
      jest.doMock('@module-federation/vite', () => ({
        federation: jest.fn(() => []),
      }));

      const { withZephyr } = require('./vite-plugin-zephyr') as {
        withZephyr: (options?: Record<string, unknown>) => Array<{
          name?: string;
          load?: (id: string) => Promise<string | null> | string | null;
        }>;
      };

      const plugins = withZephyr({
        mfConfig: {
          name: 'host',
        },
      });
      loadVirtualRuntimePlugin = plugins.find(
        (plugin) => plugin.name === 'with-zephyr'
      )?.load;
    });

    expect(loadVirtualRuntimePlugin).toBeDefined();
    const code = await Promise.resolve(
      loadVirtualRuntimePlugin?.('\0virtual:zephyr-mf-runtime-plugin')
    );
    const normalizedCode = code?.replace(/\\\\/g, '/');

    expect(code).toContain('import * as runtimePluginModule from');
    expect(normalizedCode).toMatch(/runtime-plugin\/index\.js/);
    expect(code).not.toContain("'zephyr-agent/runtime-plugin'");
    expect(code).not.toContain('"zephyr-agent/runtime-plugin"');
  });
});
