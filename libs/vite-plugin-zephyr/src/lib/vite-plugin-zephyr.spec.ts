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

  describe('config hook base handling', () => {
    interface ZephyrVitePlugin {
      name?: string;
      config?: (
        config: Record<string, unknown>,
        env: { command: string; mode: string }
      ) => Promise<unknown>;
    }

    function loadPluginWithAddressMode(addressMode?: string): {
      plugin: ZephyrVitePlugin;
      zephyr_defer_create: jest.Mock;
    } {
      let plugin: ZephyrVitePlugin | undefined;
      const zephyr_defer_create = jest.fn();

      jest.isolateModules(() => {
        jest.doMock('vite', () => ({
          loadEnv: jest.fn(() => ({})),
        }));

        const actual = jest.requireActual('zephyr-agent') as Record<string, unknown>;
        jest.doMock('zephyr-agent', () => ({
          ...actual,
          ZephyrEngine: {
            defer_create: jest.fn(() => ({
              zephyr_engine_defer: Promise.resolve({
                application_configuration: Promise.resolve({
                  ADDRESS_MODE: addressMode,
                }),
              }),
              zephyr_defer_create,
            })),
          },
        }));

        const { withZephyr } = require('./vite-plugin-zephyr') as {
          withZephyr: () => ZephyrVitePlugin[];
        };

        plugin = withZephyr()[0];
      });

      if (!plugin) {
        throw new Error('withZephyr did not return a plugin');
      }

      return { plugin, zephyr_defer_create };
    }

    test('sets a relative base for path-addressed builds without a user base', async () => {
      const { plugin, zephyr_defer_create } = loadPluginWithAddressMode('path');

      const result = await plugin.config?.({}, { command: 'build', mode: 'production' });

      expect(result).toEqual({ base: './' });
      expect(zephyr_defer_create).toHaveBeenCalledTimes(1);
    });

    test('keeps a user-provided base untouched for path-addressed builds', async () => {
      const { plugin } = loadPluginWithAddressMode('path');

      const result = await plugin.config?.(
        { base: '/my-app/' },
        { command: 'build', mode: 'production' }
      );

      expect(result).toBeNull();
    });

    test('does not change base for hostname-addressed builds', async () => {
      const { plugin } = loadPluginWithAddressMode('hostname');

      const result = await plugin.config?.({}, { command: 'build', mode: 'production' });

      expect(result).toBeNull();
    });

    test('does not start the engine or change base during dev server', async () => {
      const { plugin, zephyr_defer_create } = loadPluginWithAddressMode('path');

      const result = await plugin.config?.({}, { command: 'serve', mode: 'development' });

      expect(result).toBeNull();
      expect(zephyr_defer_create).not.toHaveBeenCalled();
    });
  });
});
