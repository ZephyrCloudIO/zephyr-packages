import { withZephyr } from './vite-plugin-zephyr';
import { federation } from '@module-federation/vite';
import { ZephyrEngine } from 'zephyr-agent';
import { extract_remotes_dependencies } from './internal/mf-vite-etl/extract-mf-vite-remotes';
import { load_resolved_remotes } from './internal/mf-vite-etl/load_resolved_remotes';
import { extract_vite_assets_map } from './internal/extract/extract_vite_assets_map';

// Mock dependencies
jest.mock('@module-federation/vite', () => ({
  federation: jest.fn().mockReturnValue([{ name: 'module-federation' }]),
}));

jest.mock('zephyr-agent', () => {
  const mockDefer = {
    zephyr_engine_defer: Promise.resolve({
      resolve_remote_dependencies: jest.fn().mockResolvedValue([]),
      start_new_build: jest.fn().mockResolvedValue(undefined),
      upload_assets: jest.fn().mockResolvedValue(undefined),
      build_finished: jest.fn().mockResolvedValue(undefined),
    }),
    zephyr_defer_create: jest.fn(),
  };

  return {
    ZephyrEngine: {
      defer_create: jest.fn().mockReturnValue(mockDefer),
    },
    zeBuildDashData: jest.fn().mockResolvedValue({}),
  };
});

jest.mock('./internal/mf-vite-etl/extract-mf-vite-remotes', () => ({
  extract_remotes_dependencies: jest.fn(),
}));

jest.mock('./internal/mf-vite-etl/load_resolved_remotes', () => ({
  load_resolved_remotes: jest.fn().mockReturnValue('modified code'),
}));

jest.mock('./internal/extract/extract_vite_assets_map', () => ({
  extract_vite_assets_map: jest.fn().mockResolvedValue({ 'test.js': 'content' }),
}));

describe('vite-plugin-zephyr', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withZephyr', () => {
    it('should return an array of plugins', () => {
      const result = withZephyr();
      expect(Array.isArray(result)).toBe(true);

      // Last plugin should be our zephyr plugin
      const zephyrPlugin = result[result.length - 1];
      expect(zephyrPlugin.name).toBe('with-zephyr');
    });

    it('should include federation plugins when mfConfig is provided', () => {
      const mfConfig = { name: 'host', remotes: {} }; // Use object for remotes, not array
      const result = withZephyr({ mfConfig });

      expect(federation).toHaveBeenCalledWith(mfConfig);
      expect(result.length).toBe(2); // federation + zephyr plugin
    });
  });

  describe('zephyrPlugin', () => {
    let plugin: any;

    beforeEach(() => {
      const plugins = withZephyr();
      plugin = plugins[plugins.length - 1];
    });

    it('should have enforce: post to ensure it runs after other plugins', () => {
      expect(plugin.enforce).toBe('post');
    });

    describe('configResolved hook', () => {
      it('should initialize zephyr_engine with correct config', async () => {
        const config = {
          root: '/project/root',
          build: { outDir: 'dist' },
          publicDir: 'public',
        };

        await plugin.configResolved(config);

        const { zephyr_defer_create } = ZephyrEngine.defer_create();
        expect(zephyr_defer_create).toHaveBeenCalledWith({
          builder: 'vite',
          context: '/project/root',
        });
      });
    });

    describe('transform hook', () => {
      beforeEach(() => {
        (extract_remotes_dependencies as jest.Mock).mockReturnValue([
          { importSpecifier: 'foo', packageName: 'foo' },
        ]);
      });

      it('should process code with module federation remotes', async () => {
        await plugin.configResolved({ root: '/project/root' });

        const result = await plugin.transform('const foo = "bar"', 'index.js');

        const { zephyr_engine_defer } = ZephyrEngine.defer_create();
        const zephyrEngine = await zephyr_engine_defer;

        expect(extract_remotes_dependencies).toHaveBeenCalledWith(
          '/project/root',
          'const foo = "bar"',
          'index.js'
        );
        expect(zephyrEngine.resolve_remote_dependencies).toHaveBeenCalled();
        expect(load_resolved_remotes).toHaveBeenCalled();
        expect(result).toBe('modified code');
      });

      it('should return original code if no dependencies are found', async () => {
        (extract_remotes_dependencies as jest.Mock).mockReturnValue(null);

        await plugin.configResolved({ root: '/project/root' });
        const result = await plugin.transform('const foo = "bar"', 'index.js');

        expect(result).toBe('const foo = "bar"');
      });
    });

    describe('closeBundle hook', () => {
      it('should upload assets and finish build', async () => {
        await plugin.configResolved({
          root: '/project/root',
          build: { outDir: 'dist' },
          publicDir: 'public',
        });

        await plugin.closeBundle();

        const { zephyr_engine_defer } = ZephyrEngine.defer_create();
        const zephyrEngine = await zephyr_engine_defer;

        expect(zephyrEngine.start_new_build).toHaveBeenCalled();
        expect(extract_vite_assets_map).toHaveBeenCalled();
        expect(zephyrEngine.upload_assets).toHaveBeenCalled();
        expect(zephyrEngine.build_finished).toHaveBeenCalled();
      });
    });
  });
});
