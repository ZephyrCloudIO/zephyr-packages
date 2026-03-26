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
});
