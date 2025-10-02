/** @jest-environment jsdom */

import { createZephyrRuntimePluginWithOTA } from './runtime-plugin';
import type { ZephyrManifest } from 'zephyr-edge-contract';

// Mock fetch for tests
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

// Mock global objects
const mockGlobal = globalThis as any;

describe('ZephyrRuntimePlugin', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    // Clear global state
    delete mockGlobal.__ZEPHYR_MANIFEST_CACHE__;
    delete mockGlobal.__ZEPHYR_MANIFEST_PROMISE__;
  });

  describe('createZephyrRuntimePluginWithOTA', () => {
    it('should create plugin and instance', () => {
      const { plugin, instance } = createZephyrRuntimePluginWithOTA();

      expect(plugin).toBeDefined();
      expect(plugin.name).toBe('zephyr-runtime-remote-resolver-ota');
      expect(instance).toBeDefined();
      expect(typeof instance.refresh).toBe('function');
      expect(typeof instance.getCurrentManifest).toBe('function');
    });

    it('should call onManifestChange when manifest changes', async () => {
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
      const { instance } = createZephyrRuntimePluginWithOTA({
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

      const eventListener = jest.fn();
      document.addEventListener('zephyr:remote-url-changed', eventListener);

      const { instance } = createZephyrRuntimePluginWithOTA({
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
    });

    it('should cache manifests by application_uid', async () => {
      const mockManifest: ZephyrManifest = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        application_uid: 'test-app-123',
        dependencies: {},
      };

      const { instance } = createZephyrRuntimePluginWithOTA();

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
    });

    it('should handle fetch errors gracefully', async () => {
      const onManifestError = jest.fn();
      const { instance } = createZephyrRuntimePluginWithOTA({
        onManifestError,
      });

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await instance.getCurrentManifest();

      expect(result).toBeUndefined();
      expect(onManifestError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should clear cache on refresh', async () => {
      const mockManifest: ZephyrManifest = {
        version: '1.0.0',
        timestamp: '2023-01-01T00:00:00Z',
        application_uid: 'test-app-123',
        dependencies: {},
      };

      const { instance } = createZephyrRuntimePluginWithOTA();

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
    });
  });

  describe('beforeRequest hook', () => {
    it('should resolve remote URLs from manifest', async () => {
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

      const { plugin } = createZephyrRuntimePluginWithOTA();

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
  });
});
