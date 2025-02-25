import { withZephyr } from './vite-plugin-zephyr';
import { ZeVitePlugin } from './ze-vite-plugin';
import { federation } from '@module-federation/vite';
import { ZephyrEngine } from 'zephyr-agent';

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

// Mock the ZeVitePlugin class
jest.mock('./ze-vite-plugin', () => {
  const mockPlugin = {
    getVitePlugin: jest.fn().mockReturnValue({
      name: 'ze-vite-plugin',
      enforce: 'post',
      configResolved: jest.fn(),
      transform: jest.fn(),
      closeBundle: jest.fn(),
    }),
  };

  return {
    ZeVitePlugin: jest.fn().mockImplementation(() => mockPlugin),
  };
});

// Mock the extract and load functions
jest.mock('./internal/mf-vite-etl/extract-mf-vite-remotes', () => ({
  extract_remotes_dependencies: jest.fn(),
}));

jest.mock('./internal/mf-vite-etl/load_resolved_remotes', () => ({
  load_resolved_remotes: jest.fn().mockReturnValue('modified code'),
}));

jest.mock('./internal/extract/extract_vite_assets_map', () => ({
  extract_vite_assets_map: jest.fn().mockResolvedValue({ 'test.js': 'content' }),
}));

// Mock ZeBasePlugin
jest.mock('zephyr-xpack-internal', () => ({
  ZeBasePlugin: class {
    constructor() {
      /* empty */
    }
  },
  ZeProcessAssetsResult: {},
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
      expect(zephyrPlugin.name).toBe('ze-vite-plugin');
    });

    it('should include federation plugins when mfConfig is provided', () => {
      const mfConfig = { name: 'host', remotes: {} };
      const result = withZephyr({ mfConfig });

      expect(federation).toHaveBeenCalledWith(mfConfig);
      expect(result.length).toBe(2); // federation + zephyr plugin
    });

    it('should create ZeVitePlugin with correct options', () => {
      const mfConfig = { name: 'host', remotes: {} };
      withZephyr({ mfConfig, wait_for_index_html: true });

      // Check if ZeVitePlugin was constructed with correct options
      expect(ZeVitePlugin).toHaveBeenCalledWith(
        expect.objectContaining({
          mfConfig,
          wait_for_index_html: true,
        })
      );
    });

    it('should initialize the Zephyr engine', () => {
      withZephyr();

      const { zephyr_defer_create } = ZephyrEngine.defer_create();
      expect(zephyr_defer_create).toHaveBeenCalledWith({
        builder: 'vite',
        context: expect.any(String), // Don't test exact path as it uses process.cwd()
      });
    });
  });

  describe('plugin configuration', () => {
    it('should create a plugin with the correct name and enforce property', () => {
      const plugins = withZephyr();
      const zephyrPlugin = plugins[plugins.length - 1];

      expect(zephyrPlugin.name).toBe('ze-vite-plugin');
      expect(zephyrPlugin.enforce).toBe('post');
    });

    it('should expose the necessary lifecycle hooks', () => {
      const plugins = withZephyr();
      const zephyrPlugin = plugins[plugins.length - 1];

      expect(typeof zephyrPlugin.configResolved).toBe('function');
      expect(typeof zephyrPlugin.transform).toBe('function');
      expect(typeof zephyrPlugin.closeBundle).toBe('function');
    });
  });
});
