/** @jest-environment jsdom */

import {
  createZephyrRuntimePlugin,
  createZephyrRuntimePluginMobile,
} from './runtime-plugin';
import type { ZephyrManifest } from 'zephyr-edge-contract';

// Mock fetch for tests
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock global objects
const mockGlobal = globalThis as any;

// Mock navigator for platform detection
const mockNavigator = () => {
  Object.defineProperty(global, 'navigator', {
    writable: true,
    configurable: true,
    value: {
      product: 'ReactNative',
    },
  });
};

const resetNavigator = () => {
  Object.defineProperty(global, 'navigator', {
    writable: true,
    configurable: true,
    value: {
      product: 'Gecko',
    },
  });
};

describe('ZephyrRuntimePlugin', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Clear global state
    delete mockGlobal.__ZEPHYR_MANIFEST_CACHE__;
    delete mockGlobal.__ZEPHYR_MANIFEST_PROMISE__;
    // Reset console.warn spy
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createZephyrRuntimePlugin (basic version)', () => {
    it('should create basic plugin without OTA features', () => {
      const plugin = createZephyrRuntimePlugin();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('zephyr-runtime-remote-resolver');
      expect(typeof plugin.beforeRequest).toBe('function');
    });

    it('should fetch manifest and resolve remotes', async () => {
      const mockManifest: ZephyrManifest = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        application_uid: 'test-app-123',
        dependencies: {
          testRemote: {
            application_uid: 'remote-uid',
            remote_entry_url: 'https://cdn.example.com/testRemote/remoteEntry.js',
            public_path: 'https://cdn.example.com/testRemote/',
            version: '1.0.0',
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockManifest),
      } as Response);

      const plugin = createZephyrRuntimePlugin();

      const mockArgs = {
        id: 'testRemote/Component',
        options: {
          remotes: [
            {
              name: 'testRemote',
              entry: 'http://localhost:3001/remoteEntry.js',
            },
          ],
        },
      };

      const result = await plugin.beforeRequest!(mockArgs as any);

      expect(result.options.remotes[0].entry).toBe(
        'https://cdn.example.com/testRemote/remoteEntry.js'
      );
    });

    it('should use custom manifest URL if provided', async () => {
      const customUrl = '/custom-manifest.json';
      const mockManifest: ZephyrManifest = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        application_uid: 'test-app-123',
        dependencies: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockManifest),
      } as Response);

      const plugin = createZephyrRuntimePlugin({ manifestUrl: customUrl });

      const mockArgs = {
        id: 'testRemote/Component',
        options: {
          remotes: [],
        },
      };

      await plugin.beforeRequest!(mockArgs as any);

      expect(mockFetch).toHaveBeenCalledWith(customUrl);
    });
  });

  describe('createZephyrRuntimePluginMobile (OTA version)', () => {
    it('should create plugin and instance with OTA features', () => {
      mockNavigator();
      const { plugin, instance } = createZephyrRuntimePluginMobile();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('zephyr-runtime-remote-resolver-ota');
      expect(instance).toBeDefined();
      expect(typeof instance.refresh).toBe('function');
      expect(typeof instance.getCurrentManifest).toBe('function');
      resetNavigator();
    });

    it('should warn when used on non-mobile platform', () => {
      resetNavigator(); // Ensure we're not on React Native
      const consoleWarnSpy = jest.spyOn(console, 'warn');

      createZephyrRuntimePluginMobile();

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('createZephyrRuntimePluginMobile is designed for React Native')
      );
    });

    it('should NOT warn when used on React Native platform', () => {
      mockNavigator();
      const consoleWarnSpy = jest.spyOn(console, 'warn');

      createZephyrRuntimePluginMobile();

      expect(consoleWarnSpy).not.toHaveBeenCalled();
      resetNavigator();
    });

    it('should call onManifestChange when manifest changes', async () => {
      mockNavigator();
      const mockManifest: ZephyrManifest = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        application_uid: 'test-app-123',
        dependencies: {
          remote1: {
            application_uid: 'remote1-uid',
            remote_entry_url: 'https://cdn.example.com/remote1/v1.0.0/remoteEntry.js',
            public_path: 'https://cdn.example.com/remote1/v1.0.0/',
            version: '1.0.0',
          },
        },
      };

      const newManifest: ZephyrManifest = {
        ...mockManifest,
        timestamp: '2023-01-02T00:00:00Z',
        dependencies: {
          ...mockManifest.dependencies,
          remote1: {
            ...mockManifest.dependencies['remote1'],
            remote_entry_url: 'https://cdn.example.com/remote1/v1.0.1/remoteEntry.js',
          },
        },
      };

      const onManifestChange = jest.fn();
      const { instance } = createZephyrRuntimePluginMobile({
        onManifestChange,
      });

      // Mock fetch responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockManifest),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(newManifest),
        } as Response);

      // First call - initial manifest
      await instance.getCurrentManifest();

      // Second call - updated manifest
      await instance.refresh();

      expect(onManifestChange).toHaveBeenCalledWith(newManifest, mockManifest);
      resetNavigator();
    });

    it('should emit custom event for remote URL changes', async () => {
      const mockManifest: ZephyrManifest = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        application_uid: 'test-app-123',
        dependencies: {
          remote1: {
            application_uid: 'remote1-uid',
            remote_entry_url: 'https://cdn.example.com/remote1/v1.0.0/remoteEntry.js',
            public_path: 'https://cdn.example.com/remote1/v1.0.0/',
            version: '1.0.0',
          },
        },
      };

      const newManifest: ZephyrManifest = {
        ...mockManifest,
        timestamp: '2023-01-02T00:00:00Z',
        dependencies: {
          remote1: {
            ...mockManifest.dependencies['remote1'],
            remote_entry_url: 'https://cdn.example.com/remote1/v1.0.1/remoteEntry.js',
          },
        },
      };

      mockNavigator();
      const eventListener = jest.fn();
      document.addEventListener('zephyr:remote-url-changed', eventListener);

      const { instance } = createZephyrRuntimePluginMobile({
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onManifestChange: () => {},
      });

      // Mock fetch responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockManifest),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(newManifest),
        } as Response);

      // First call - initial manifest
      await instance.getCurrentManifest();

      // Second call - updated manifest (should trigger event)
      await instance.refresh();

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'zephyr:remote-url-changed',
          detail: expect.objectContaining({
            remoteName: 'remote1',
            oldUrl: 'https://cdn.example.com/remote1/v1.0.0/remoteEntry.js',
            newUrl: 'https://cdn.example.com/remote1/v1.0.1/remoteEntry.js',
            manifest: newManifest,
          }),
        })
      );

      document.removeEventListener('zephyr:remote-url-changed', eventListener);
      resetNavigator();
    });

    it('should cache manifests by application_uid', async () => {
      mockNavigator();
      const mockManifest: ZephyrManifest = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        application_uid: 'test-app-123',
        dependencies: {},
      };

      const { instance } = createZephyrRuntimePluginMobile();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockManifest),
      } as Response);

      // First call should fetch
      const result1 = await instance.getCurrentManifest();
      expect(result1).toEqual(mockManifest);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify cache exists
      expect(mockGlobal.__ZEPHYR_MANIFEST_CACHE__).toBeDefined();
      expect(mockGlobal.__ZEPHYR_MANIFEST_CACHE__['test-app-123']).toBeDefined();
      resetNavigator();
    });

    it('should handle fetch errors gracefully', async () => {
      mockNavigator();
      const onManifestError = jest.fn();
      const { instance } = createZephyrRuntimePluginMobile({
        onManifestError,
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await instance.getCurrentManifest();

      expect(result).toBeUndefined();
      expect(onManifestError).toHaveBeenCalledWith(expect.any(Error));
      resetNavigator();
    });

    it('should clear cache on refresh', async () => {
      mockNavigator();
      const mockManifest: ZephyrManifest = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        application_uid: 'test-app-123',
        dependencies: {},
      };

      const { instance } = createZephyrRuntimePluginMobile();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockManifest),
      } as Response);

      // Initial fetch
      await instance.getCurrentManifest();

      // Verify cache exists
      expect(mockGlobal.__ZEPHYR_MANIFEST_CACHE__['test-app-123']).toBeDefined();

      // Refresh should clear cache
      await instance.refresh();

      // Verify fetch was called again (cache was cleared)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      resetNavigator();
    });
  });

  describe('beforeRequest hook', () => {
    it('should resolve remote URLs from manifest (mobile plugin)', async () => {
      mockNavigator();
      const mockManifest: ZephyrManifest = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        application_uid: 'test-app-123',
        dependencies: {
          testRemote: {
            application_uid: 'remote-uid',
            remote_entry_url: 'https://cdn.example.com/testRemote/remoteEntry.js',
            public_path: 'https://cdn.example.com/testRemote/',
            version: '1.0.0',
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockManifest),
      } as Response);

      const { plugin } = createZephyrRuntimePluginMobile();

      const mockArgs = {
        id: 'testRemote/Component',
        options: {
          remotes: [
            {
              name: 'testRemote',
              entry: 'http://localhost:3001/remoteEntry.js',
            },
          ],
        },
      };

      const result = await plugin.beforeRequest!(mockArgs as any);

      expect(result.options.remotes[0].entry).toBe(
        'https://cdn.example.com/testRemote/remoteEntry.js'
      );
      resetNavigator();
    });
  });
});
